import {
  Eye,
  EyeOff,
  KeyRound,
  Save,
  X,
} from "lucide-react";
import {
  useEffect,
  useState,
} from "react";

const UserPasswordDialog = ({
  isOpen,
  user,
  isSubmitting = false,
  requestError = "",
  onClose,
  onSubmit,
}) => {
  const [password, setPassword] =
    useState("");

  const [passwordConfirmation, setPasswordConfirmation] =
    useState("");

  const [showPassword, setShowPassword] =
    useState(false);

  const [validationError, setValidationError] =
    useState("");

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const previousOverflow =
      document.body.style.overflow;

    const handleKeyDown = (event) => {
      if (
        event.key === "Escape" &&
        !isSubmitting
      ) {
        onClose();
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener(
      "keydown",
      handleKeyDown,
    );

    return () => {
      document.body.style.overflow =
        previousOverflow;

      window.removeEventListener(
        "keydown",
        handleKeyDown,
      );
    };
  }, [isOpen, isSubmitting, onClose]);

  if (!isOpen || !user) {
    return null;
  }

  const handleSubmit = (event) => {
    event.preventDefault();

    if (password.length < 8) {
      setValidationError(
        "Password baru harus terdiri dari minimal 8 karakter.",
      );
      return;
    }

    if (password !== passwordConfirmation) {
      setValidationError(
        "Konfirmasi password tidak sesuai.",
      );
      return;
    }

    onSubmit(password);
  };

  const handlePasswordChange = (event) => {
    setPassword(event.target.value);
    setValidationError("");
  };

  const handleConfirmationChange = (event) => {
    setPasswordConfirmation(event.target.value);
    setValidationError("");
  };

  return (
    <div
      className="product-modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (
          event.target === event.currentTarget &&
          !isSubmitting
        ) {
          onClose();
        }
      }}
    >
      <section
        className="product-modal user-password-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="user-password-title"
      >
        <header className="product-modal-header">
          <div>
            <span className="product-modal-eyebrow">
              Keamanan akun
            </span>

            <h2 id="user-password-title">
              Reset password
            </h2>
          </div>

          <button
            type="button"
            className="product-modal-close"
            aria-label="Tutup reset password"
            disabled={isSubmitting}
            onClick={onClose}
          >
            <X aria-hidden="true" />
          </button>
        </header>

        <form
          className="product-form"
          onSubmit={handleSubmit}
        >
          <div className="user-password-content">
            <div className="user-password-heading">
              <div className="user-password-icon">
                <KeyRound aria-hidden="true" />
              </div>

              <div>
                <strong>{user.full_name}</strong>

                <span>@{user.username}</span>
              </div>
            </div>

            <p className="user-password-description">
              Masukkan password baru untuk akun ini.
              Pengguna harus memakai password baru saat
              login berikutnya.
            </p>

            <div className="user-password-fields">
              <label className="product-form-field">
                <span>Password baru</span>

                <div className="user-password-input">
                  <input
                    type={
                      showPassword
                        ? "text"
                        : "password"
                    }
                    value={password}
                    placeholder="Minimal 8 karakter"
                    autoComplete="new-password"
                    disabled={isSubmitting}
                    onChange={handlePasswordChange}
                  />

                  <button
                    type="button"
                    aria-label={
                      showPassword
                        ? "Sembunyikan password"
                        : "Tampilkan password"
                    }
                    disabled={isSubmitting}
                    onClick={() =>
                      setShowPassword(
                        (current) => !current,
                      )
                    }
                  >
                    {showPassword ? (
                      <EyeOff aria-hidden="true" />
                    ) : (
                      <Eye aria-hidden="true" />
                    )}
                  </button>
                </div>
              </label>

              <label className="product-form-field">
                <span>Konfirmasi password baru</span>

                <div className="user-password-input">
                  <input
                    type={
                      showPassword
                        ? "text"
                        : "password"
                    }
                    value={passwordConfirmation}
                    placeholder="Ulangi password baru"
                    autoComplete="new-password"
                    disabled={isSubmitting}
                    onChange={
                      handleConfirmationChange
                    }
                  />

                  <button
                    type="button"
                    aria-label={
                      showPassword
                        ? "Sembunyikan password"
                        : "Tampilkan password"
                    }
                    disabled={isSubmitting}
                    onClick={() =>
                      setShowPassword(
                        (current) => !current,
                      )
                    }
                  >
                    {showPassword ? (
                      <EyeOff aria-hidden="true" />
                    ) : (
                      <Eye aria-hidden="true" />
                    )}
                  </button>
                </div>
              </label>
            </div>

            {(validationError || requestError) && (
              <div
                className="product-form-error"
                role="alert"
              >
                {validationError || requestError}
              </div>
            )}
          </div>

          <footer className="product-form-actions">
            <button
              type="button"
              className="product-form-cancel"
              disabled={isSubmitting}
              onClick={onClose}
            >
              Batal
            </button>

            <button
              type="submit"
              className="product-form-submit"
              disabled={isSubmitting}
            >
              <Save aria-hidden="true" />

              {isSubmitting
                ? "Menyimpan..."
                : "Simpan password"}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
};

export default UserPasswordDialog;
