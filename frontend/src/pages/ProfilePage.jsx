import {
  Camera,
  ImageOff,
  Save,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { useEffect, useState } from "react";
import {
  deleteUserAvatarRequest,
  uploadUserAvatarRequest,
} from "../api/users";
import FilePickerButton from "../components/forms/FilePickerButton";
import UserAvatar from "../components/users/UserAvatar";
import useAuth from "../hooks/useAuth";
import "../styles/profile.css";

const ROLE_LABELS = {
  ADMIN: "Administrator",
  PURCHASING: "Purchasing",
  WAREHOUSE: "Warehouse",
  SALES: "Sales",
  FINANCE: "Finance",
  MANAGER: "Manager",
};

const ProfilePage = () => {
  const { user, refreshUser } = useAuth();
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => () => {
    if (avatarPreview) URL.revokeObjectURL(avatarPreview);
  }, [avatarPreview]);

  const clearPreview = () => {
    if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    setAvatarPreview("");
    setAvatarFile(null);
  };

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setErrorMessage("");
    setSuccessMessage("");

    if (file.size > 2 * 1024 * 1024) {
      setErrorMessage("Ukuran foto profil maksimal 2 MB.");
      event.target.value = "";
      return;
    }

    if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
    event.target.value = "";
  };

  const handleSave = async () => {
    if (!avatarFile || !user?.id) return;

    try {
      setIsSaving(true);
      setErrorMessage("");
      setSuccessMessage("");
      await uploadUserAvatarRequest(user.id, avatarFile);
      await refreshUser();
      clearPreview();
      setSuccessMessage("Foto profil berhasil diperbarui.");
    } catch (error) {
      setErrorMessage(
        error.response?.data?.message ||
          "Foto profil gagal diperbarui.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!user?.id || !user.has_avatar) return;

    try {
      setIsDeleting(true);
      setErrorMessage("");
      setSuccessMessage("");
      await deleteUserAvatarRequest(user.id);
      await refreshUser();
      clearPreview();
      setSuccessMessage("Foto profil berhasil dihapus.");
    } catch (error) {
      setErrorMessage(
        error.response?.data?.message ||
          "Foto profil gagal dihapus.",
      );
    } finally {
      setIsDeleting(false);
    }
  };

  const isBusy = isSaving || isDeleting;
  const displayName = user?.full_name || user?.username || "User";

  return (
    <div className="profile-page">
      <section className="page-heading">
        <div>
          <p>Akun</p>
          <h2>Profil Saya</h2>
          <span>
            Kelola foto profil akun yang sedang digunakan.
          </span>
        </div>
      </section>

      <section className="profile-card">
        <div className="profile-card-heading">
          <UserRound aria-hidden="true" />
          <div>
            <h3>{displayName}</h3>
            <p>
              Foto profil akan digunakan pada header dan identitas akun.
            </p>
          </div>
        </div>

        <div className="profile-avatar-panel">
          <div className="profile-avatar-preview">
            {avatarPreview ? (
              <img src={avatarPreview} alt="Preview foto profil" />
            ) : (
              <UserAvatar user={user} />
            )}
          </div>

          <div className="profile-avatar-copy">
            <strong>Foto profil</strong>
            <span>JPG, PNG, atau WebP. Maksimal 2 MB.</span>

            <div className="profile-avatar-actions">
              <FilePickerButton
                icon={Camera}
                accept="image/jpeg,image/png,image/webp"
                buttonText={
                  user?.has_avatar || avatarFile
                    ? "Ganti foto"
                    : "Pilih foto"
                }
                disabled={isBusy}
                onChange={handleFileChange}
              />

              {avatarFile && (
                <button
                  type="button"
                  className="profile-save-button"
                  disabled={isBusy}
                  onClick={handleSave}
                >
                  <Save aria-hidden="true" />
                  {isSaving ? "Menyimpan..." : "Simpan foto"}
                </button>
              )}

              {user?.has_avatar && !avatarFile && (
                <button
                  type="button"
                  className="profile-delete-button"
                  disabled={isBusy}
                  onClick={handleDelete}
                >
                  <ImageOff aria-hidden="true" />
                  {isDeleting ? "Menghapus..." : "Hapus foto"}
                </button>
              )}
            </div>

            {avatarFile && (
              <button
                type="button"
                className="profile-cancel-preview"
                disabled={isBusy}
                onClick={clearPreview}
              >
                Batalkan foto yang dipilih
              </button>
            )}
          </div>
        </div>

        <div className="profile-details-grid">
          <div>
            <span>Nama lengkap</span>
            <strong>{user?.full_name || "-"}</strong>
          </div>
          <div>
            <span>Username</span>
            <strong>{user?.username || "-"}</strong>
          </div>
          <div>
            <span>Email</span>
            <strong>{user?.email || "-"}</strong>
          </div>
          <div>
            <span>Role</span>
            <strong>
              {ROLE_LABELS[user?.role] || user?.role || "-"}
            </strong>
          </div>
        </div>

        <div className="profile-security-note">
          <ShieldCheck aria-hidden="true" />
          <p>
            Pengguna hanya dapat mengganti foto profil miliknya sendiri.
            Pengaturan role, status, dan akun pengguna lain tetap dikelola
            melalui User Management oleh Administrator.
          </p>
        </div>

        {errorMessage && (
          <div className="profile-message is-error" role="alert">
            {errorMessage}
          </div>
        )}

        {successMessage && (
          <div className="profile-message is-success" role="status">
            {successMessage}
          </div>
        )}
      </section>
    </div>
  );
};

export default ProfilePage;
