const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { after, test } = require("node:test");

const storageDirectory = fs.mkdtempSync(
  path.join(os.tmpdir(), "supply-flow-payment-proofs-"),
);
process.env.PAYMENT_PROOF_STORAGE_DIR = storageDirectory;

const {
  removeStoredProofFile,
  storeProofFile,
} = require("../src/services/paymentProofService");

const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

after(() => {
  fs.rmSync(storageDirectory, { recursive: true, force: true });
});

test("payment proof storage validates file signatures and removes stored files", async () => {
  const stored = await storeProofFile({
    originalname: "bukti transfer.png",
    buffer: png,
  });

  assert.equal(stored.mimeType, "image/png");
  assert.equal(stored.originalName, "bukti transfer.png");
  assert.equal(stored.checksum.length, 64);
  assert.equal(
    fs.existsSync(path.join(storageDirectory, stored.storageName)),
    true,
  );

  await removeStoredProofFile(stored.storageName);
  assert.equal(
    fs.existsSync(path.join(storageDirectory, stored.storageName)),
    false,
  );

  await assert.rejects(
    storeProofFile({
      originalname: "bukan-gambar.png",
      buffer: Buffer.from("not an image"),
    }),
    /Format bukti pembayaran/,
  );
});
