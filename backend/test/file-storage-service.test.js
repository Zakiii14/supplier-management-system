const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { afterEach, test } = require("node:test");

const {
  VERCEL_SERVER_UPLOAD_LIMIT_BYTES,
  configureFileStorageEnvironment,
  createDirectoryStorage,
  createVercelBlobStorage,
  ensureApplicationFileStorageReady,
  getApplicationStorageDirectories,
  getServerUploadLimitBytes,
} = require("../src/services/fileStorageService");

const TRACKED_KEYS = [
  "DEPLOYMENT_TARGET",
  "FILE_STORAGE_PROVIDER",
  "FILE_STORAGE_ROOT",
  "BLOB_PATH_PREFIX",
  "BLOB_READ_WRITE_TOKEN",
  "PAYMENT_PROOF_STORAGE_DIR",
  "USER_AVATAR_STORAGE_DIR",
  "SUPPLIER_INVOICE_STORAGE_DIR",
];
const originalEnvironment = Object.fromEntries(
  TRACKED_KEYS.map((key) => [key, process.env[key]]),
);

const restoreEnvironment = () => {
  for (const [key, value] of Object.entries(originalEnvironment)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
};

afterEach(restoreEnvironment);

test("directory storage writes, reads, lists, and removes private files safely", async () => {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), "supplyflow-storage-"),
  );
  try {
    const storage = createDirectoryStorage(
      path.join(root, "files"),
    );
    await storage.ensureReady();
    await storage.write("example.txt", Buffer.from("hello"));

    assert.equal(storage.exists("example.txt"), true);
    assert.equal(
      (await storage.readBuffer("example.txt")).toString("utf8"),
      "hello",
    );
    assert.deepEqual(await storage.listNames(), ["example.txt"]);

    assert.equal(storage.exists("../outside.txt"), false);
    await assert.rejects(
      storage.write("../outside.txt", Buffer.from("blocked")),
      /Invalid storage file name/,
    );

    await storage.clearNames(["example.txt"]);
    assert.equal(storage.exists("example.txt"), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("FILE_STORAGE_ROOT controls every filesystem namespace", () => {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), "supplyflow-root-"),
  );
  try {
    process.env.FILE_STORAGE_PROVIDER = "filesystem";
    process.env.FILE_STORAGE_ROOT = root;
    configureFileStorageEnvironment();

    assert.deepEqual(getApplicationStorageDirectories(), [
      path.join(root, "payment-proofs"),
      path.join(root, "user-avatars"),
      path.join(root, "supplier-invoices"),
    ]);
    assert.equal(
      process.env.PAYMENT_PROOF_STORAGE_DIR,
      path.join(root, "payment-proofs"),
    );
    assert.equal(
      process.env.USER_AVATAR_STORAGE_DIR,
      path.join(root, "user-avatars"),
    );
    assert.equal(
      process.env.SUPPLIER_INVOICE_STORAGE_DIR,
      path.join(root, "supplier-invoices"),
    );

    const readyDirectories = ensureApplicationFileStorageReady();
    assert.deepEqual(
      readyDirectories,
      getApplicationStorageDirectories(),
    );
    for (const directory of readyDirectories) {
      assert.equal(fs.statSync(directory).isDirectory(), true);
    }
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("Vercel Blob adapter keeps private objects under the configured namespace", async () => {
  const objects = new Map();
  const calls = [];
  const mockBlob = {
    async put(pathname, body, options) {
      calls.push(["put", pathname, options]);
      objects.set(pathname, Buffer.from(body));
      return { pathname };
    },
    async get(pathname, options) {
      calls.push(["get", pathname, options]);
      const value = objects.get(pathname);
      if (!value) return null;
      return {
        stream: new Blob([value]).stream(),
        blob: { pathname },
      };
    },
    async del(pathname, options) {
      calls.push(["del", pathname, options]);
      objects.delete(pathname);
    },
    async list(options) {
      calls.push(["list", options.prefix, options]);
      return {
        blobs: [...objects.keys()]
          .filter((pathname) => pathname.startsWith(options.prefix))
          .map((pathname) => ({ pathname })),
        hasMore: false,
        cursor: undefined,
      };
    },
  };

  const storage = createVercelBlobStorage({
    namespace: "user-avatars",
    pathPrefix: "supplyflow/demo",
    token: "test-token",
    blobModuleLoader: async () => mockBlob,
  });

  await storage.write("avatar.png", Buffer.from("image"));
  assert.equal(
    (await storage.readBuffer("avatar.png")).toString("utf8"),
    "image",
  );
  assert.deepEqual(await storage.listNames(), ["avatar.png"]);
  assert.equal(calls[0][1], "supplyflow/demo/user-avatars/avatar.png");
  assert.equal(calls[0][2].access, "private");
  assert.equal(calls[0][2].token, "test-token");
  assert.equal(calls[1][2].useCache, false);

  await storage.clearNames(["avatar.png"]);
  assert.deepEqual(await storage.listNames(), []);
  await assert.rejects(
    storage.write("../outside.png", Buffer.from("blocked")),
    /Invalid storage file name/,
  );
});

test("Vercel deployment uses a safe server upload ceiling", () => {
  process.env.DEPLOYMENT_TARGET = "vercel";
  assert.equal(
    getServerUploadLimitBytes(5 * 1024 * 1024),
    VERCEL_SERVER_UPLOAD_LIMIT_BYTES,
  );

  process.env.DEPLOYMENT_TARGET = "node";
  assert.equal(
    getServerUploadLimitBytes(5 * 1024 * 1024),
    5 * 1024 * 1024,
  );
});
