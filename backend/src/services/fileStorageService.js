const crypto = require("node:crypto");
const fs = require("node:fs");
const fsPromises = require("node:fs/promises");
const path = require("node:path");

const DEFAULT_STORAGE_ROOT = path.resolve(__dirname, "../../storage");
const SAFE_STORAGE_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,254}$/;
const STORAGE_TARGETS = [
  ["payment-proofs", "PAYMENT_PROOF_STORAGE_DIR"],
  ["user-avatars", "USER_AVATAR_STORAGE_DIR"],
  ["supplier-invoices", "SUPPLIER_INVOICE_STORAGE_DIR"],
];
const STORAGE_PROVIDERS = new Set(["filesystem", "vercel-blob"]);
const DEPLOYMENT_TARGETS = new Set(["node", "vercel"]);
const VERCEL_SERVER_UPLOAD_LIMIT_BYTES = 4 * 1024 * 1024;

const getDeploymentTarget = () => {
  const configured = String(process.env.DEPLOYMENT_TARGET || "")
    .trim()
    .toLowerCase();
  if (configured) return configured;
  return process.env.VERCEL === "1" ? "vercel" : "node";
};

const getFileStorageProvider = () =>
  String(process.env.FILE_STORAGE_PROVIDER || "filesystem")
    .trim()
    .toLowerCase();

const validateStorageName = (storageName) => {
  if (
    !SAFE_STORAGE_NAME.test(storageName || "") ||
    path.basename(storageName) !== storageName
  ) {
    const error = new Error("Invalid storage file name");
    error.code = "INVALID_STORAGE_NAME";
    throw error;
  }
  return storageName;
};

const resolveStorageDirectory = (namespace, legacyVariable) => {
  const root = String(process.env.FILE_STORAGE_ROOT || "").trim();
  if (root) return path.join(path.resolve(root), namespace);

  const legacy = legacyVariable
    ? String(process.env[legacyVariable] || "").trim()
    : "";
  return legacy
    ? path.resolve(legacy)
    : path.join(DEFAULT_STORAGE_ROOT, namespace);
};

const normalizeBlobPrefix = (value) => {
  const normalized = String(value || "supplyflow")
    .trim()
    .replace(/^\/+|\/+$/g, "");
  if (!normalized) return "supplyflow";
  const segments = normalized.split("/");
  if (
    segments.some(
      (segment) =>
        !segment ||
        segment === "." ||
        segment === ".." ||
        !/^[A-Za-z0-9._-]+$/.test(segment),
    )
  ) {
    throw new Error("BLOB_PATH_PREFIX contains an invalid path segment");
  }
  return segments.join("/");
};

const configureFileStorageEnvironment = () => {
  if (getFileStorageProvider() !== "filesystem") return;

  const root = String(process.env.FILE_STORAGE_ROOT || "").trim();
  if (!root) return;

  const resolvedRoot = path.resolve(root);
  for (const [namespace, variable] of STORAGE_TARGETS) {
    process.env[variable] = path.join(resolvedRoot, namespace);
  }
};

const createDirectoryStorage = (directory) => {
  const resolvedDirectory = path.resolve(directory);
  const filePath = (storageName) =>
    path.join(resolvedDirectory, validateStorageName(storageName));

  return {
    provider: "filesystem",
    directory: resolvedDirectory,
    async ensureReady() {
      await fsPromises.mkdir(resolvedDirectory, { recursive: true });
      const probe = path.join(
        resolvedDirectory,
        `.storage-probe-${crypto.randomUUID()}`,
      );
      try {
        await fsPromises.writeFile(probe, "ok", { flag: "wx" });
        await fsPromises.readFile(probe);
      } finally {
        await fsPromises.rm(probe, { force: true });
      }
    },
    async write(storageName, buffer) {
      if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
        throw new Error("Storage write requires a non-empty buffer");
      }
      await fsPromises.mkdir(resolvedDirectory, { recursive: true });
      await fsPromises.writeFile(filePath(storageName), buffer, { flag: "wx" });
    },
    async remove(storageName) {
      if (!storageName) return;
      try {
        await fsPromises.unlink(filePath(storageName));
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
    },
    async readBuffer(storageName) {
      try {
        return await fsPromises.readFile(filePath(storageName));
      } catch (error) {
        if (error.code === "ENOENT") return null;
        throw error;
      }
    },
    async listNames() {
      let entries;
      try {
        entries = await fsPromises.readdir(resolvedDirectory, {
          withFileTypes: true,
        });
      } catch (error) {
        if (error.code === "ENOENT") return [];
        throw error;
      }
      return entries
        .filter((entry) => entry.isFile() && SAFE_STORAGE_NAME.test(entry.name))
        .map((entry) => entry.name)
        .sort();
    },
    async clearNames(names) {
      for (const name of names || []) {
        await this.remove(name);
      }
      await fsPromises.mkdir(resolvedDirectory, { recursive: true });
    },
    exists(storageName) {
      try {
        return fs.existsSync(filePath(storageName));
      } catch (error) {
        if (error.code === "INVALID_STORAGE_NAME") return false;
        throw error;
      }
    },
    createReadStream(storageName) {
      return fs.createReadStream(filePath(storageName));
    },
  };
};

const defaultBlobModuleLoader = () => import("@vercel/blob");

const createVercelBlobStorage = ({
  namespace,
  blobModuleLoader = defaultBlobModuleLoader,
  token = String(process.env.BLOB_READ_WRITE_TOKEN || "").trim(),
  pathPrefix = normalizeBlobPrefix(process.env.BLOB_PATH_PREFIX),
} = {}) => {
  if (!STORAGE_TARGETS.some(([knownNamespace]) => knownNamespace === namespace)) {
    throw new Error(`Unsupported storage namespace: ${namespace}`);
  }

  const namespacePrefix = `${pathPrefix}/${namespace}`;
  const pathnameFor = (storageName) =>
    `${namespacePrefix}/${validateStorageName(storageName)}`;
  const authOptions = () => (token ? { token } : {});

  return {
    provider: "vercel-blob",
    namespace,
    directory: null,
    async ensureReady() {
      await blobModuleLoader();
    },
    async write(storageName, buffer) {
      if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
        throw new Error("Storage write requires a non-empty buffer");
      }
      const { put } = await blobModuleLoader();
      await put(pathnameFor(storageName), buffer, {
        access: "private",
        addRandomSuffix: false,
        ...authOptions(),
      });
    },
    async remove(storageName) {
      if (!storageName) return;
      const { del } = await blobModuleLoader();
      await del(pathnameFor(storageName), authOptions());
    },
    async readBuffer(storageName) {
      const { get } = await blobModuleLoader();
      const result = await get(pathnameFor(storageName), {
        access: "private",
        useCache: false,
        ...authOptions(),
      });
      if (!result) return null;
      return Buffer.from(await new Response(result.stream).arrayBuffer());
    },
    async listNames() {
      const { list } = await blobModuleLoader();
      const names = [];
      const prefix = `${namespacePrefix}/`;
      let cursor;
      do {
        const result = await list({
          prefix,
          cursor,
          limit: 1000,
          ...authOptions(),
        });
        for (const blob of result.blobs || []) {
          const relative = blob.pathname?.startsWith(prefix)
            ? blob.pathname.slice(prefix.length)
            : "";
          if (
            relative &&
            !relative.includes("/") &&
            SAFE_STORAGE_NAME.test(relative)
          ) {
            names.push(relative);
          }
        }
        cursor = result.hasMore ? result.cursor : undefined;
      } while (cursor);
      return [...new Set(names)].sort();
    },
    async clearNames(names) {
      for (const name of names || []) {
        await this.remove(name);
      }
    },
  };
};

const createApplicationStorage = (namespace, legacyVariable) => {
  const provider = getFileStorageProvider();
  if (!STORAGE_PROVIDERS.has(provider)) {
    throw new Error(`Unsupported FILE_STORAGE_PROVIDER: ${provider}`);
  }
  if (provider === "vercel-blob") {
    return createVercelBlobStorage({ namespace });
  }
  return createDirectoryStorage(
    resolveStorageDirectory(namespace, legacyVariable),
  );
};

const getApplicationStorageTargets = () =>
  STORAGE_TARGETS.map(([namespace, variable]) => {
    const storage = createApplicationStorage(namespace, variable);
    return {
      namespace,
      provider: storage.provider,
      directory: storage.directory,
      storage,
    };
  });

const getApplicationStorageDirectories = () =>
  getApplicationStorageTargets()
    .filter((target) => target.provider === "filesystem")
    .map((target) => target.directory);

const ensureApplicationFileStorageReady = () => {
  if (getFileStorageProvider() !== "filesystem") return [];

  const directories = [...new Set(getApplicationStorageDirectories())];
  for (const directory of directories) {
    fs.mkdirSync(directory, { recursive: true });
    const probe = path.join(
      directory,
      `.storage-probe-${crypto.randomUUID()}`,
    );
    try {
      fs.writeFileSync(probe, "ok", { flag: "wx" });
      fs.readFileSync(probe);
    } finally {
      fs.rmSync(probe, { force: true });
    }
  }
  return directories;
};

const getServerUploadLimitBytes = (defaultBytes) =>
  getDeploymentTarget() === "vercel"
    ? Math.min(defaultBytes, VERCEL_SERVER_UPLOAD_LIMIT_BYTES)
    : defaultBytes;

module.exports = {
  DEFAULT_STORAGE_ROOT,
  DEPLOYMENT_TARGETS,
  STORAGE_PROVIDERS,
  VERCEL_SERVER_UPLOAD_LIMIT_BYTES,
  configureFileStorageEnvironment,
  createApplicationStorage,
  createDirectoryStorage,
  createVercelBlobStorage,
  ensureApplicationFileStorageReady,
  getApplicationStorageDirectories,
  getApplicationStorageTargets,
  getDeploymentTarget,
  getFileStorageProvider,
  getServerUploadLimitBytes,
  normalizeBlobPrefix,
  resolveStorageDirectory,
};
