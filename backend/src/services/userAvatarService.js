const crypto = require("node:crypto");
const fs = require("node:fs");
const fsPromises = require("node:fs/promises");
const path = require("node:path");
const multer = require("multer");

const MAX_AVATAR_SIZE_BYTES = 2 * 1024 * 1024;
const storageDirectory = path.resolve(
  process.env.USER_AVATAR_STORAGE_DIR ||
    path.join(__dirname, "../../storage/user-avatars"),
);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { files: 1, fileSize: MAX_AVATAR_SIZE_BYTES },
});

const uploadUserAvatar = (req, res, next) => {
  upload.single("avatar")(req, res, (error) => {
    if (!error) return next();
    return res.status(400).json({
      success: false,
      message:
        error.code === "LIMIT_FILE_SIZE"
          ? "Ukuran foto profil maksimal 2 MB"
          : "Foto profil gagal diunggah",
    });
  });
};

const detectImageType = (buffer) => {
  if (buffer?.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { extension: ".jpg", mimeType: "image/jpeg" };
  }
  if (buffer?.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { extension: ".png", mimeType: "image/png" };
  }
  if (buffer?.length >= 12 && buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP") {
    return { extension: ".webp", mimeType: "image/webp" };
  }
  return null;
};

const normalizeName = (value) =>
  (path.basename(value || "foto-profil").replace(/[\u0000-\u001f\u007f]/g, "").trim() || "foto-profil").slice(0, 255);

const storeAvatar = async (file) => {
  const type = detectImageType(file?.buffer);
  if (!type) {
    const error = new Error("Format foto profil harus JPG, PNG, atau WebP");
    error.statusCode = 400;
    throw error;
  }
  await fsPromises.mkdir(storageDirectory, { recursive: true });
  const storageName = `${crypto.randomUUID()}${type.extension}`;
  await fsPromises.writeFile(path.join(storageDirectory, storageName), file.buffer, { flag: "wx" });
  return {
    storageName,
    originalName: normalizeName(file.originalname),
    mimeType: type.mimeType,
    sizeBytes: file.buffer.length,
  };
};

const removeAvatar = async (storageName) => {
  if (!/^[0-9a-f-]{36}\.(jpg|png|webp)$/i.test(storageName || "")) return;
  try {
    await fsPromises.unlink(path.join(storageDirectory, storageName));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
};

const streamAvatar = (res, avatar) => {
  if (!/^[0-9a-f-]{36}\.(jpg|png|webp)$/i.test(avatar.avatar_storage_name || "")) return false;
  const avatarPath = path.join(storageDirectory, avatar.avatar_storage_name);
  if (!fs.existsSync(avatarPath)) return false;
  res.set({
    "Content-Type": avatar.avatar_mime_type,
    "Content-Length": String(avatar.avatar_size_bytes),
    "Cache-Control": "private, max-age=300",
    "X-Content-Type-Options": "nosniff",
    "Content-Disposition": `inline; filename="${normalizeName(avatar.avatar_original_name).replace(/"/g, "")}"`,
  });
  fs.createReadStream(avatarPath).pipe(res);
  return true;
};

module.exports = { uploadUserAvatar, storeAvatar, removeAvatar, streamAvatar };
