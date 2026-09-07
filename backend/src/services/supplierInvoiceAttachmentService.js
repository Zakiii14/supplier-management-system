const crypto = require("node:crypto");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");
const multer = require("multer");

const directory = path.resolve(process.env.SUPPLIER_INVOICE_STORAGE_DIR || path.join(__dirname, "../../storage/supplier-invoices"));
const upload = multer({ storage: multer.memoryStorage(), limits: { files: 3, fileSize: 5 * 1024 * 1024 } });
const uploadAttachments = (req, res, next) => upload.array("attachments", 3)(req, res, (error) => {
  if (!error) return next();
  return res.status(400).json({ success: false, message: error.code === "LIMIT_FILE_SIZE" ? "Ukuran setiap lampiran maksimal 5 MB" : "Maksimal 3 lampiran invoice supplier" });
});

const detect = (buffer) => {
  if (buffer?.subarray(0, 4).toString("ascii") === "%PDF") return [".pdf", "application/pdf"];
  if (buffer?.[0] === 0xff && buffer?.[1] === 0xd8 && buffer?.[2] === 0xff) return [".jpg", "image/jpeg"];
  if (buffer?.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]))) return [".png", "image/png"];
  if (buffer?.subarray(0,4).toString("ascii") === "RIFF" && buffer?.subarray(8,12).toString("ascii") === "WEBP") return [".webp", "image/webp"];
  return null;
};
const cleanName = (value) => (path.basename(value || "invoice-supplier").replace(/[\u0000-\u001f\u007f]/g, "").trim() || "invoice-supplier").slice(0,255);
const store = async (file) => {
  const type = detect(file?.buffer);
  if (!type) { const error = new Error("Lampiran harus berupa PDF, JPG, PNG, atau WebP"); error.statusCode = 400; throw error; }
  await fsp.mkdir(directory, { recursive: true });
  const storageName = `${crypto.randomUUID()}${type[0]}`;
  await fsp.writeFile(path.join(directory, storageName), file.buffer, { flag: "wx" });
  return { storageName, originalName: cleanName(file.originalname), mimeType: type[1], sizeBytes: file.buffer.length };
};
const remove = async (name) => { if (!/^[0-9a-f-]{36}\.(pdf|jpg|png|webp)$/i.test(name || "")) return; try { await fsp.unlink(path.join(directory,name)); } catch (error) { if (error.code !== "ENOENT") throw error; } };
const stream = (res,row) => { const target=path.join(directory,row.storage_name); if (!fs.existsSync(target)) return false; res.set({"Content-Type":row.mime_type,"Content-Length":String(row.size_bytes),"Content-Disposition":`inline; filename="${cleanName(row.original_name).replace(/"/g,"")}"`,"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}); fs.createReadStream(target).pipe(res); return true; };

module.exports = { uploadAttachments, store, remove, stream };
