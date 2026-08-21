import { useState } from "react";
import {
  Eye,
  EyeOff,
  LoaderCircle,
  LockKeyhole,
  PackageCheck,
  UserRound,
} from "lucide-react";
import {
  useLocation,
  useNavigate,
} from "react-router-dom";
import useAuth from "../hooks/useAuth";
import "../styles/login.css";

const LoginPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] =
    useState(false);
  const [isSubmitting, setIsSubmitting] =
    useState(false);
  const [errorMessage, setErrorMessage] =
    useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();
    setErrorMessage("");

    if (!identifier.trim() || !password) {
      setErrorMessage(
        "Username/email dan password wajib diisi.",
      );
      return;
    }

    try {
      setIsSubmitting(true);

      await login(identifier.trim(), password);

      const destination =
        location.state?.from?.pathname || "/";

      navigate(destination, { replace: true });
    } catch (error) {
      setErrorMessage(
        error.response?.data?.message ||
          "Login gagal. Pastikan backend aktif dan coba kembali.",
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
            Supplier Management System
          </p>

          <h1>
            Kelola seluruh proses bisnis dalam satu
            tempat.
          </h1>

          <p>
            Pantau pemasok, pembelian, persediaan,
            penjualan, pengiriman, dan keuangan melalui
            sistem yang terintegrasi.
          </p>
        </div>
      </section>

      <section className="login-form-panel">
        <div className="login-card">
          <div className="login-card-header">
            <h2>Selamat datang</h2>
            <p>Masuk menggunakan akun yang terdaftar.</p>
          </div>

          <form onSubmit={handleSubmit}>
            {errorMessage && (
              <div className="login-error" role="alert">
                {errorMessage}
              </div>
            )}

            <label className="login-field">
              <span>Username atau email</span>

              <div className="login-input-wrapper">
                <UserRound aria-hidden="true" />

                <input
                  type="text"
                  name="identifier"
                  value={identifier}
                  onChange={(event) =>
                    setIdentifier(event.target.value)
                  }
                  placeholder="Masukkan username atau email"
                  autoComplete="username"
                  disabled={isSubmitting}
                />
              </div>
            </label>

            <label className="login-field">
              <span>Password</span>

              <div className="login-input-wrapper">
                <LockKeyhole aria-hidden="true" />

                <input
                  type={
                    showPassword ? "text" : "password"
                  }
                  name="password"
                  value={password}
                  onChange={(event) =>
                    setPassword(event.target.value)
                  }
                  placeholder="Masukkan password"
                  autoComplete="current-password"
                  disabled={isSubmitting}
                />

                <button
                  type="button"
                  className="password-toggle"
                  onClick={() =>
                    setShowPassword((current) => !current)
                  }
                  aria-label={
                    showPassword
                      ? "Sembunyikan password"
                      : "Tampilkan password"
                  }
                  disabled={isSubmitting}
                >
                  {showPassword ? (
                    <EyeOff aria-hidden="true" />
                  ) : (
                    <Eye aria-hidden="true" />
                  )}
                </button>
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

              {isSubmitting ? "Memproses..." : "Masuk"}
            </button>
          </form>

          <p className="login-footer">
            Akses sistem diberikan oleh administrator.
          </p>
        </div>
      </section>
    </main>
  );
};

export default LoginPage;