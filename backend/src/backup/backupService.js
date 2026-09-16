const crypto = require("node:crypto");
const fs = require("node:fs");
const fsPromises = require("node:fs/promises");
const path = require("node:path");

const BACKUP_FORMAT_VERSION = 1;
const BACKUP_PREFIX = "supplyflow-";

const toPortablePath = (value) => value.split(path.sep).join("/");

const assertSafeRelativePath = (value) => {
  if (typeof value !== "string" || !value.trim() || path.isAbsolute(value)) {
    throw new Error("Backup manifest contains an invalid relative path");
  }

  const normalized = path.normalize(value);
  if (
    normalized === ".." ||
    normalized.startsWith(`..${path.sep}`) ||
    normalized.includes(`${path.sep}..${path.sep}`)
  ) {
    throw new Error("Backup manifest contains path traversal");
  }

  return normalized;
};

const sha256File = (filePath) =>
  new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha256");
    const stream = fs.createReadStream(filePath);
    stream.on("error", reject);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("hex")));
  });

const describeFile = async (filePath, relativePath) => {
  const stat = await fsPromises.stat(filePath);
  if (!stat.isFile()) {
    throw new Error(`Backup entry is not a regular file: ${relativePath}`);
  }

  return {
    path: toPortablePath(relativePath),
    size_bytes: stat.size,
    sha256: await sha256File(filePath),
  };
};

const walkDirectory = async (rootDirectory, currentDirectory = rootDirectory) => {
  let entries;
  try {
    entries = await fsPromises.readdir(currentDirectory, { withFileTypes: true });
  } catch (error) {
    if (error.code === "ENOENT" && currentDirectory === rootDirectory) return [];
    throw error;
  }

  const files = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const absolutePath = path.join(currentDirectory, entry.name);
    const relativePath = path.relative(rootDirectory, absolutePath);

    if (entry.isSymbolicLink()) {
      throw new Error(`Symbolic links are not allowed in backup storage: ${relativePath}`);
    }
    if (entry.isDirectory()) {
      files.push(...(await walkDirectory(rootDirectory, absolutePath)));
      continue;
    }
    if (!entry.isFile()) {
      throw new Error(`Unsupported storage entry in backup: ${relativePath}`);
    }

    files.push(await describeFile(absolutePath, relativePath));
  }

  return files;
};

const copyDirectoryStrict = async (sourceDirectory, destinationDirectory) => {
  await fsPromises.mkdir(destinationDirectory, { recursive: true });

  let entries;
  try {
    entries = await fsPromises.readdir(sourceDirectory, { withFileTypes: true });
  } catch (error) {
    if (error.code === "ENOENT") return;
    throw error;
  }

  for (const entry of entries) {
    const sourcePath = path.join(sourceDirectory, entry.name);
    const destinationPath = path.join(destinationDirectory, entry.name);

    if (entry.isSymbolicLink()) {
      throw new Error(`Symbolic links are not allowed in backup storage: ${entry.name}`);
    }
    if (entry.isDirectory()) {
      await copyDirectoryStrict(sourcePath, destinationPath);
      continue;
    }
    if (!entry.isFile()) {
      throw new Error(`Unsupported storage entry in backup: ${entry.name}`);
    }

    await fsPromises.copyFile(sourcePath, destinationPath);
  }
};

const formatBackupName = (createdAt, backupId) => {
  const timestamp = createdAt
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
  const suffix = (backupId || crypto.randomUUID()).replace(/[^a-f0-9]/gi, "").slice(0, 8);
  return `${BACKUP_PREFIX}${timestamp}-${suffix.toLowerCase()}`;
};

const verifyStorageNamespace = async (resolvedDirectory, namespace) => {
  const expectedFiles = new Map();

  for (const file of namespace.files) {
    if (
      !file ||
      !Number.isInteger(file.size_bytes) ||
      file.size_bytes < 0 ||
      typeof file.sha256 !== "string" ||
      !/^[a-f0-9]{64}$/i.test(file.sha256)
    ) {
      throw new Error("Backup storage file manifest is invalid");
    }

    const safeRelative = assertSafeRelativePath(file.path);
    const portablePath = toPortablePath(safeRelative);
    if (expectedFiles.has(portablePath)) {
      throw new Error(`Backup storage manifest contains duplicate path: ${portablePath}`);
    }
    expectedFiles.set(portablePath, file);
  }

  const namespaceDirectory = path.join(
    resolvedDirectory,
    "files",
    namespace.namespace,
  );
  const actualFiles = await walkDirectory(namespaceDirectory);

  if (actualFiles.length !== expectedFiles.size) {
    throw new Error(
      `Storage backup manifest does not match files: ${namespace.namespace}`,
    );
  }

  for (const actual of actualFiles) {
    const expected = expectedFiles.get(actual.path);
    if (!expected) {
      throw new Error(
        `Storage backup contains untracked file: ${namespace.namespace}/${actual.path}`,
      );
    }
    if (actual.size_bytes !== expected.size_bytes || actual.sha256 !== expected.sha256) {
      throw new Error(
        `Storage backup checksum verification failed: ${namespace.namespace}/${actual.path}`,
      );
    }
  }

  return actualFiles.length;
};

const verifyBackupBundle = async (backupDirectory) => {
  const resolvedDirectory = path.resolve(backupDirectory);
  const manifestPath = path.join(resolvedDirectory, "manifest.json");
  let manifest;

  try {
    manifest = JSON.parse(await fsPromises.readFile(manifestPath, "utf8"));
  } catch (error) {
    throw new Error(`Backup manifest cannot be read: ${error.message}`);
  }

  if (manifest.format_version !== BACKUP_FORMAT_VERSION || manifest.application !== "SupplyFlow") {
    throw new Error("Unsupported SupplyFlow backup format");
  }

  if (manifest.database?.file !== "database.dump") {
    throw new Error("Backup manifest database entry is invalid");
  }

  const databasePath = path.join(resolvedDirectory, "database.dump");
  const actualDatabase = await describeFile(databasePath, "database.dump");
  if (
    actualDatabase.size_bytes !== manifest.database.size_bytes ||
    actualDatabase.sha256 !== manifest.database.sha256
  ) {
    throw new Error("Database backup checksum verification failed");
  }

  if (!Array.isArray(manifest.storage)) {
    throw new Error("Backup storage manifest is invalid");
  }

  const seenNamespaces = new Set();
  let storageFileCount = 0;
  for (const namespace of manifest.storage) {
    if (
      typeof namespace?.namespace !== "string" ||
      !/^[a-z0-9][a-z0-9-]*$/.test(namespace.namespace) ||
      !Array.isArray(namespace.files)
    ) {
      throw new Error("Backup storage namespace is invalid");
    }
    if (seenNamespaces.has(namespace.namespace)) {
      throw new Error(`Backup storage namespace is duplicated: ${namespace.namespace}`);
    }
    seenNamespaces.add(namespace.namespace);
    storageFileCount += await verifyStorageNamespace(resolvedDirectory, namespace);
  }

  return {
    manifest,
    databasePath,
    storageFileCount,
  };
};

const createBackupBundle = async ({
  backupRoot,
  storageTargets,
  dumpDatabase,
  consistencyMode = "live",
  now = () => new Date(),
  backupId,
}) => {
  const resolvedRoot = path.resolve(backupRoot);
  const createdAt = now();
  const backupName = formatBackupName(createdAt, backupId);
  const finalDirectory = path.join(resolvedRoot, backupName);
  const temporaryDirectory = path.join(resolvedRoot, `.${backupName}.incomplete`);

  await fsPromises.mkdir(resolvedRoot, { recursive: true });
  await fsPromises.rm(temporaryDirectory, { recursive: true, force: true });
  await fsPromises.mkdir(temporaryDirectory, { recursive: false });

  try {
    const databasePath = path.join(temporaryDirectory, "database.dump");
    await dumpDatabase(databasePath);
    const databaseDescription = await describeFile(databasePath, "database.dump");
    if (databaseDescription.size_bytes === 0) {
      throw new Error("Database backup is empty");
    }

    const storage = [];
    for (const target of storageTargets) {
      const snapshotDirectory = path.join(
        temporaryDirectory,
        "files",
        target.namespace,
      );
      await copyDirectoryStrict(target.directory, snapshotDirectory);
      storage.push({
        namespace: target.namespace,
        files: await walkDirectory(snapshotDirectory),
      });
    }

    const manifest = {
      format_version: BACKUP_FORMAT_VERSION,
      application: "SupplyFlow",
      created_at: createdAt.toISOString(),
      consistency_mode: consistencyMode,
      database: {
        file: "database.dump",
        format: "postgresql-custom",
        size_bytes: databaseDescription.size_bytes,
        sha256: databaseDescription.sha256,
      },
      storage,
    };

    await fsPromises.writeFile(
      path.join(temporaryDirectory, "manifest.json"),
      `${JSON.stringify(manifest, null, 2)}\n`,
      { flag: "wx" },
    );

    await verifyBackupBundle(temporaryDirectory);
    await fsPromises.rename(temporaryDirectory, finalDirectory);

    return {
      backupDirectory: finalDirectory,
      manifest,
    };
  } catch (error) {
    await fsPromises.rm(temporaryDirectory, { recursive: true, force: true });
    throw error;
  }
};

const pathExists = async (targetPath) => {
  try {
    await fsPromises.access(targetPath);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
};

const rollbackStorageSwap = async (entries) => {
  for (const entry of [...entries].reverse()) {
    if (entry.installed) {
      await fsPromises.rm(entry.targetDirectory, { recursive: true, force: true });
    }
    if (entry.previousMoved && (await pathExists(entry.previousDirectory))) {
      await fsPromises.rename(entry.previousDirectory, entry.targetDirectory);
    }
    await fsPromises.rm(entry.stageDirectory, { recursive: true, force: true });
  }
};

const restoreBackupBundle = async ({
  backupDirectory,
  storageTargets,
  restoreDatabase,
  confirmRestore = false,
}) => {
  if (!confirmRestore) {
    throw new Error("Restore requires explicit confirmation");
  }

  const verification = await verifyBackupBundle(backupDirectory);
  const namespaceMap = new Map(
    verification.manifest.storage.map((entry) => [entry.namespace, entry]),
  );
  const swapEntries = [];
  const restoreId = crypto.randomUUID().replace(/-/g, "").slice(0, 8);

  try {
    for (const target of storageTargets) {
      if (!namespaceMap.has(target.namespace)) {
        throw new Error(`Backup is missing storage namespace: ${target.namespace}`);
      }

      const targetDirectory = path.resolve(target.directory);
      const parentDirectory = path.dirname(targetDirectory);
      const stageDirectory = `${targetDirectory}.restore-${restoreId}`;
      const previousDirectory = `${targetDirectory}.pre-restore-${restoreId}`;
      await fsPromises.mkdir(parentDirectory, { recursive: true });
      await fsPromises.rm(stageDirectory, { recursive: true, force: true });
      await fsPromises.rm(previousDirectory, { recursive: true, force: true });
      await copyDirectoryStrict(
        path.join(path.resolve(backupDirectory), "files", target.namespace),
        stageDirectory,
      );

      swapEntries.push({
        targetDirectory,
        stageDirectory,
        previousDirectory,
        hadPrevious: await pathExists(targetDirectory),
        previousMoved: false,
        installed: false,
      });
    }

    for (const entry of swapEntries) {
      if (entry.hadPrevious) {
        await fsPromises.rename(entry.targetDirectory, entry.previousDirectory);
        entry.previousMoved = true;
      }
      await fsPromises.rename(entry.stageDirectory, entry.targetDirectory);
      entry.installed = true;
    }

    await restoreDatabase(verification.databasePath);
  } catch (error) {
    await rollbackStorageSwap(swapEntries);
    throw error;
  }

  for (const entry of swapEntries) {
    await fsPromises.rm(entry.previousDirectory, { recursive: true, force: true });
  }

  return verification.manifest;
};

const pruneBackupBundles = async ({ backupRoot, retentionDays, now = () => new Date() }) => {
  const resolvedRoot = path.resolve(backupRoot);
  let entries;
  try {
    entries = await fsPromises.readdir(resolvedRoot, { withFileTypes: true });
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }

  const cutoff = now().getTime() - retentionDays * 24 * 60 * 60 * 1000;
  const removed = [];

  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith(BACKUP_PREFIX)) continue;
    const directory = path.join(resolvedRoot, entry.name);
    try {
      const manifest = JSON.parse(
        await fsPromises.readFile(path.join(directory, "manifest.json"), "utf8"),
      );
      const createdAt = new Date(manifest.created_at).getTime();
      if (Number.isFinite(createdAt) && createdAt < cutoff) {
        await fsPromises.rm(directory, { recursive: true, force: true });
        removed.push(directory);
      }
    } catch {
      // Invalid bundles are preserved for manual inspection instead of being deleted automatically.
    }
  }

  return removed;
};

module.exports = {
  BACKUP_FORMAT_VERSION,
  createBackupBundle,
  pruneBackupBundles,
  restoreBackupBundle,
  verifyBackupBundle,
};
