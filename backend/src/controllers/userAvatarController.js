const pool = require("../config/database");
const { storeAvatar, removeAvatar, streamAvatar } = require("../services/userAvatarService");
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const validateAccess = (req, res) => {
  if (!UUID_PATTERN.test(req.params.id)) {
    res.status(400).json({ success: false, message: "Invalid user ID" });
    return false;
  }
  if (req.user.role !== "ADMIN" && req.user.id !== req.params.id) {
    res.status(403).json({ success: false, message: "You do not have permission to access this photo" });
    return false;
  }
  return true;
};

const getUserAvatar = async (req, res) => {
  if (!validateAccess(req, res)) return;
  const result = await pool.query(`SELECT avatar_storage_name, avatar_original_name, avatar_mime_type, avatar_size_bytes FROM app.users WHERE id = $1`, [req.params.id]);
  if (!result.rows.length || !result.rows[0].avatar_storage_name || !streamAvatar(res, result.rows[0])) {
    return res.status(404).json({ success: false, message: "Foto profil tidak ditemukan" });
  }
};

const replaceUserAvatar = async (req, res) => {
  if (!validateAccess(req, res)) return;
  let stored;
  try {
    if (!req.file) return res.status(400).json({ success: false, message: "Pilih foto profil terlebih dahulu" });
    stored = await storeAvatar(req.file);
    const current = await pool.query(`SELECT avatar_storage_name FROM app.users WHERE id=$1`, [req.params.id]);
    if (!current.rows.length) {
      await removeAvatar(stored.storageName);
      return res.status(404).json({ success: false, message: "User not found" });
    }
    await pool.query(
      `UPDATE app.users SET avatar_storage_name=$1, avatar_original_name=$2, avatar_mime_type=$3, avatar_size_bytes=$4, avatar_updated_at=NOW(), updated_at=NOW() WHERE id=$5`,
      [stored.storageName, stored.originalName, stored.mimeType, stored.sizeBytes, req.params.id],
    );
    await removeAvatar(current.rows[0].avatar_storage_name).catch((error) => {
      console.error("Failed to remove previous user avatar:", error);
    });
    return res.status(200).json({ success: true, message: "Foto profil berhasil disimpan", data: { has_avatar: true, avatar_updated_at: new Date().toISOString() } });
  } catch (error) {
    if (stored) await removeAvatar(stored.storageName);
    return res.status(error.statusCode || 500).json({ success: false, message: error.statusCode ? error.message : "Foto profil gagal disimpan" });
  }
};

const deleteUserAvatar = async (req, res) => {
  if (!validateAccess(req, res)) return;
  const current = await pool.query(`SELECT avatar_storage_name FROM app.users WHERE id=$1`, [req.params.id]);
  if (!current.rows.length) return res.status(404).json({ success: false, message: "User not found" });
  await pool.query(`UPDATE app.users SET avatar_storage_name=NULL, avatar_original_name=NULL, avatar_mime_type=NULL, avatar_size_bytes=NULL, avatar_updated_at=NOW(), updated_at=NOW() WHERE id=$1`, [req.params.id]);
  await removeAvatar(current.rows[0].avatar_storage_name).catch((error) => {
    console.error("Failed to remove deleted user avatar file:", error);
  });
  return res.status(200).json({ success: true, message: "Foto profil berhasil dihapus", data: { has_avatar: false } });
};

module.exports = { getUserAvatar, replaceUserAvatar, deleteUserAvatar };
