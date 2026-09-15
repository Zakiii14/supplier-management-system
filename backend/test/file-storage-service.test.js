const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { afterEach, test } = require("node:test");

const {
  configureFileStorageEnvironment,
  createDirectoryStorage,
  ensureApplicationFileStorageReady,
  getApplicationStorageDirectories,
} = require("../src/services/fileStorageService");

const originalEnvironment = {
  FILE_STORAGE_ROOT: process.env.FILE_STORAGE_ROOT,
  PAYMENT_PROOF_STORAGE_DIR: process.env.PAYMENT_PROOF_STORAGE_DIR,
  USER_AVATAR_STORAGE_DIR: process.env.USER_AVATAR_STORAGE_DIR,
  SUPPLIER_INVOICE_STORAGE_DIR: process.env.SUPPLIER_INVOICE_STORAGE_DIR,
};

const restoreEnvironment = () => {
  for (const [key, value] of Object.entries(originalEnvironment)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
};

afterEach(restoreEnvironment);

test("directory storage writes, reads, and removes private files safely", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "supplyflow-storage-"));
  try {
    const storage = createDirectoryStorage(path.join(root, "files"));
    await storage.ensureReady();
    await storage.write("example.txt", Buffer.from("hello"));

    assert.equal(storage.exists("example.txt"), true);
    assert.equal(
      fs.readFileSync(path.join(root, "files", "example.txt"), "utf8"),
      "hello",
    );

    assert.equal(storage.exists("../outside.txt"), false);
    await assert.rejects(
      storage.write("../outside.txt", Buffer.from("blocked")),
      /Invalid storage file name/,
    );

    await storage.remove("example.txt");
    assert.equal(storage.exists("example.txt"), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("FILE_STORAGE_ROOT controls every application storage namespace", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "supplyflow-root-"));
  try {
    process.env.FILE_STORAGE_ROOT = root;
    configureFileStorageEnvironment();

    assert.deepEqual(getApplicationStorageDirectories(), [
      path.join(root, "payment-proofs"),
      path.join(root, "user-avatars"),
      path.join(root, "supplier-invoices"),
    ]);
    assert.equal(process.env.PAYMENT_PROOF_STORAGE_DIR, path.join(root, "payment-proofs"));
    assert.equal(process.env.USER_AVATAR_STORAGE_DIR, path.join(root, "user-avatars"));
    assert.equal(process.env.SUPPLIER_INVOICE_STORAGE_DIR, path.join(root, "supplier-invoices"));

    const readyDirectories = ensureApplicationFileStorageReady();
    assert.deepEqual(readyDirectories, getApplicationStorageDirectories());
    for (const directory of readyDirectories) {
      assert.equal(fs.statSync(directory).isDirectory(), true);
    }
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
