const crypto = require("node:crypto");
const fs = require("node:fs");
const fsPromises = require("node:fs/promises");
const path = require("node:path");
const multer = require("multer");

const MAX_PROOF_FILES = 3;
const MAX_PROOF_SIZE_BYTES = 5 * 1024 * 1024;

const storageDirectory = path.resolve(
  process.env.PAYMENT_PROOF_STORAGE_DIR ||
    path.join(__dirname, "../../storage/payment-proofs"),
);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: MAX_PROOF_FILES,
    fileSize: MAX_PROOF_SIZE_BYTES,
  },
});

const wrapUpload = (middleware) => (req, res, next) => {
  middleware(req, res, (error) => {
    if (!error) {
      next();
      return;
    }

    const message =
      error.code === "LIMIT_FILE_SIZE"
        ? "Ukuran setiap bukti pembayaran maksimal 5 MB"
        : error.code === "LIMIT_FILE_COUNT"
          ? "Maksimal 3 bukti pembayaran dalam satu transaksi"
          : "Bukti pembayaran gagal diunggah";

    res.status(400).json({
      success: false,
      message,
    });
  });
};

const uploadProofs = wrapUpload(
  upload.array("proofs", MAX_PROOF_FILES),
);

const uploadReplacementProof = wrapUpload(
  upload.single("proof"),
);

const detectFileType = (buffer) => {
  if (
    buffer.length >= 4 &&
    buffer[0] === 0x25 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x44 &&
    buffer[3] === 0x46
  ) {
    return { extension: ".pdf", mimeType: "application/pdf" };
  }

  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return { extension: ".jpg", mimeType: "image/jpeg" };
  }

  if (
    buffer.length >= 8 &&
    buffer.subarray(0, 8).equals(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    )
  ) {
    return { extension: ".png", mimeType: "image/png" };
  }

  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return { extension: ".webp", mimeType: "image/webp" };
  }

  return null;
};

const normalizeOriginalName = (value) => {
  const baseName = path.basename(value || "bukti-pembayaran");
  const cleaned = baseName.replace(/[\u0000-\u001f\u007f]/g, "").trim();

  return (cleaned || "bukti-pembayaran").slice(0, 255);
};

const storeProofFile = async (file) => {
  if (!file?.buffer?.length) {
    const error = new Error("File bukti pembayaran tidak tersedia");
    error.statusCode = 400;
    throw error;
  }

  const detectedType = detectFileType(file.buffer);

  if (!detectedType) {
    const error = new Error(
      "Format bukti pembayaran harus PDF, JPG, PNG, atau WebP",
    );
    error.statusCode = 400;
    throw error;
  }

  await fsPromises.mkdir(storageDirectory, { recursive: true });

  const storageName = `${crypto.randomUUID()}${detectedType.extension}`;
  const destination = path.join(storageDirectory, storageName);
  const checksum = crypto
    .createHash("sha256")
    .update(file.buffer)
    .digest("hex");

  await fsPromises.writeFile(destination, file.buffer, { flag: "wx" });

  return {
    originalName: normalizeOriginalName(file.originalname),
    storageName,
    mimeType: detectedType.mimeType,
    sizeBytes: file.buffer.length,
    checksum,
  };
};

const removeStoredProofFile = async (storageName) => {
  if (!/^[0-9a-f-]{36}\.(pdf|jpg|png|webp)$/i.test(storageName || "")) {
    return;
  }

  try {
    await fsPromises.unlink(path.join(storageDirectory, storageName));
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
  }
};

const removeStoredProofFiles = async (proofs) => {
  await Promise.all(
    proofs.map((proof) => removeStoredProofFile(proof.storageName)),
  );
};

const getStoredProofPath = (storageName) => {
  if (!/^[0-9a-f-]{36}\.(pdf|jpg|png|webp)$/i.test(storageName || "")) {
    return null;
  }

  return path.join(storageDirectory, storageName);
};

const streamStoredProof = (res, proof, download = false) => {
  const proofPath = getStoredProofPath(proof.storage_name);

  if (!proofPath || !fs.existsSync(proofPath)) {
    return false;
  }

  const disposition = download ? "attachment" : "inline";
  const safeName = normalizeOriginalName(proof.original_name).replace(/"/g, "");
  const asciiName = safeName.replace(/[^\x20-\x7e]/g, "_");

  res.set({
    "Content-Type": proof.mime_type,
    "Content-Length": String(proof.size_bytes),
    "Content-Disposition": `${disposition}; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(safeName)}`,
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  });

  fs.createReadStream(proofPath).pipe(res);
  return true;
};

const serializeProof = (proof) => ({
  id: proof.id,
  original_name: proof.original_name,
  mime_type: proof.mime_type,
  size_bytes: Number(proof.size_bytes),
  checksum_sha256: proof.checksum_sha256,
  uploaded_by: proof.uploaded_by,
  uploaded_by_name: proof.uploaded_by_name || null,
  created_at: proof.created_at,
  updated_at: proof.updated_at,
});

const storeAndInsertProofs = async ({
  client,
  files = [],
  ownerColumn,
  ownerId,
  uploadedBy,
}) => {
  if (
    !["customer_payment_id", "supplier_payment_id"].includes(
      ownerColumn,
    )
  ) {
    throw new Error("Invalid payment proof owner");
  }

  const storedProofs = [];

  try {
    for (const file of files) {
      const stored = await storeProofFile(file);
      storedProofs.push(stored);

      await client.query(
        `
        INSERT INTO app.payment_proofs (
          ${ownerColumn},
          original_name,
          storage_name,
          mime_type,
          size_bytes,
          checksum_sha256,
          uploaded_by
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        `,
        [
          ownerId,
          stored.originalName,
          stored.storageName,
          stored.mimeType,
          stored.sizeBytes,
          stored.checksum,
          uploadedBy,
        ],
      );
    }

    return storedProofs;
  } catch (error) {
    await removeStoredProofFiles(storedProofs);
    throw error;
  }
};

module.exports = {
  MAX_PROOF_FILES,
  removeStoredProofFile,
  removeStoredProofFiles,
  serializeProof,
  storeAndInsertProofs,
  storeProofFile,
  streamStoredProof,
  uploadProofs,
  uploadReplacementProof,
};
