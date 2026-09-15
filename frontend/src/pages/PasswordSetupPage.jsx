import { useEffect, useState } from "react";
import {
  Eye,
  EyeOff,
  LoaderCircle,
  LockKeyhole,
  PackageCheck,
} from "lucide-react";
import {
  Link,
  useNavigate,
  useSearchParams,
} from "react-router-dom";

import {
  activateAccountRequest,
  resetPasswordRequest,
  validateActivationTokenRequest,
  validateResetPasswordTokenRequest,
} from "../api/auth";
import "../styles/login.css";

const PasswordSetupPage = ({ mode = "reset" }) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";
  const isActivation = mode === "activation";

  const [account, setAccount] = useState(null);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    const validate = async () => {
      if (!token) {
        setErrorMessage("Tautan tidak valid atau tidak lengkap.");
        setIsChecking(false);
        return;
      }

      try {
        const data = isActivation
          ? await validateActivationTokenRequest(token)
          : await validateResetPasswordTokenRequest(token);

        if (!cancelled) {
          setAccount(data);
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(
            error.response?.data?.message ||
              "Tautan tidak valid atau sudah kedaluwarsa.",
          );
        }
      } finally {
        if (!cancelled) {
          setIsChecking(false);
        }
      }
    };

    validate();

    return () => {
      cancelled = true;
    };
  }, [token, isActivation]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setErrorMessage("");

    if (password.length < 8) {
      setErrorMessage("Password harus minimal 8 karakter.");
      return;
    }

    if (password !== confirmation) {
      setErrorMessage("Konfirmasi password tidak sesuai.");
      return;
    }

    try {
      setIsSubmitting(true);

      const payload = {
        token,
        password,
        password_confirmation: confirmation,
      };

      const response = isActivation
        ? await activateAccountRequest(payload)
        : await resetPasswordRequest(payload);

      setSuccessMessage(
        response.message ||
          (isActivation
            ? "Akun berhasil diaktifkan."
            : "Password berhasil diubah."),
      );

      window.setTimeout(() => {
        navigate("/login", { replace: true });
      }, 1200);
    } catch (error) {
      setErrorMessage(
        error.response?.data?.message ||
          "Perubahan password gagal diproses.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="login-page">
      <section className="login-brand-panel">
        <div className="login-brand">
          <span className="login-brand-icon">
            <PackageCheck aria-hidden="true" />
          </span>
          <span>SupplyFlow</span>
        </div>

        <div className="login-brand-content">
          <p className="login-eyebrow">
            {isActivation ? "Aktivasi akun" : "Keamanan akun"}
          </p>
          <h1>
            {isActivation
              ? "Selesaikan aktivasi akun SupplyFlow."
              : "Buat password baru untuk akun Anda."}
          </h1>
          <p>
            Gunakan password yang kuat dan jangan gunakan ulang
            password yang sama dengan layanan lain.
          </p>
        </div>
      </section>

      <section className="login-form-panel">
        <div className="login-card">
          <div className="login-card-header">
            <h2>
              {isActivation ? "Aktifkan akun" : "Reset password"}
            </h2>
            <p>
              {account?.full_name
                ? `Halo ${account.full_name}, tentukan password akun Anda.`
                : account?.email
                  ? `Akun ${account.email}`
                  : "Periksa tautan dan tentukan password baru."}
            </p>
          </div>

          {isChecking ? (
            <div className="session-loading">
              <div className="session-loading-spinner" aria-hidden="true" />
              <p>Memeriksa tautan...</p>
            </div>
          ) : successMessage ? (
            <div className="login-success" role="status">
              {successMessage} Mengarahkan ke halaman login...
            </div>
          ) : errorMessage && !account ? (
            <>
              <div className="login-error" role="alert">
                {errorMessage}
              </div>
              <p className="login-footer">
                <Link to={isActivation ? "/login" : "/forgot-password"}>
                  {isActivation
                    ? "Kembali ke login"
                    : "Minta tautan reset baru"}
                </Link>
              </p>
            </>
          ) : (
            <form onSubmit={handleSubmit}>
              {errorMessage && (
                <div className="login-error" role="alert">
                  {errorMessage}
                </div>
              )}

              <label className="login-field">
                <span>Password baru</span>
                <div className="login-input-wrapper">
                  <LockKeyhole aria-hidden="true" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    placeholder="Minimal 8 karakter"
                    autoComplete="new-password"
                    disabled={isSubmitting}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
                    disabled={isSubmitting}
                    onClick={() => setShowPassword((current) => !current)}
                  >
                    {showPassword ? (
                      <EyeOff aria-hidden="true" />
                    ) : (
                      <Eye aria-hidden="true" />
                    )}
                  </button>
                </div>
              </label>

              <label className="login-field">
                <span>Konfirmasi password</span>
                <div className="login-input-wrapper">
                  <LockKeyhole aria-hidden="true" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={confirmation}
                    placeholder="Ulangi password baru"
                    autoComplete="new-password"
                    disabled={isSubmitting}
                    onChange={(event) => setConfirmation(event.target.value)}
                  />
                </div>
              </label>

              <button
                type="submit"
                className="login-submit"
                disabled={isSubmitting}
              >
                {isSubmitting && (
                  <LoaderCircle
                    className="login-spinner"
                    aria-hidden="true"
                  />
                )}
                {isSubmitting
                  ? "Memproses..."
                  : isActivation
                    ? "Aktifkan akun"
                    : "Simpan password baru"}
              </button>
            </form>
          )}
        </div>
      </section>
    </main>
  );
};

export default PasswordSetupPage;
