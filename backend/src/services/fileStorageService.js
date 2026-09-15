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

const resolveStorageDirectory = (namespace, legacyVariable) => {
  const root = String(process.env.FILE_STORAGE_ROOT || "").trim();
  if (root) return path.join(path.resolve(root), namespace);

  const legacy = legacyVariable
    ? String(process.env[legacyVariable] || "").trim()
    : "";
  return legacy ? path.resolve(legacy) : path.join(DEFAULT_STORAGE_ROOT, namespace);
};

const configureFileStorageEnvironment = () => {
  const root = String(process.env.FILE_STORAGE_ROOT || "").trim();
  if (!root) return;

  const resolvedRoot = path.resolve(root);
  for (const [namespace, variable] of STORAGE_TARGETS) {
    process.env[variable] = path.join(resolvedRoot, namespace);
  }
};

const createDirectoryStorage = (directory) => {
  const resolvedDirectory = path.resolve(directory);
  const filePath = (storageName) => {
    if (!SAFE_STORAGE_NAME.test(storageName || "") || path.basename(storageName) !== storageName) {
      const error = new Error("Invalid storage file name");
      error.code = "INVALID_STORAGE_NAME";
      throw error;
    }
    return path.join(resolvedDirectory, storageName);
  };

  return {
    directory: resolvedDirectory,
    async ensureReady() {
      await fsPromises.mkdir(resolvedDirectory, { recursive: true });
      const probe = path.join(resolvedDirectory, `.storage-probe-${crypto.randomUUID()}`);
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

const getApplicationStorageDirectories = () =>
  STORAGE_TARGETS.map(([namespace, variable]) =>
    resolveStorageDirectory(namespace, variable),
  );

const ensureApplicationFileStorageReady = () => {
  const directories = [...new Set(getApplicationStorageDirectories())];
  for (const directory of directories) {
    fs.mkdirSync(directory, { recursive: true });
    const probe = path.join(directory, `.storage-probe-${crypto.randomUUID()}`);
    try {
      fs.writeFileSync(probe, "ok", { flag: "wx" });
      fs.readFileSync(probe);
    } finally {
      fs.rmSync(probe, { force: true });
    }
  }
  return directories;
};

module.exports = {
  DEFAULT_STORAGE_ROOT,
  configureFileStorageEnvironment,
  createDirectoryStorage,
  ensureApplicationFileStorageReady,
  getApplicationStorageDirectories,
  resolveStorageDirectory,
};
