import { useState } from "react";
import {
  Eye,
  EyeOff,
  LoaderCircle,
  LockKeyhole,
  PackageCheck,
  PlayCircle,
  UserRound,
} from "lucide-react";
import {
  Link,
  useLocation,
  useNavigate,
} from "react-router-dom";
import useAuth from "../hooks/useAuth";
import "../styles/login.css";
import "../styles/demo-login.css";

const IS_DEMO_MODE =
  import.meta.env.VITE_DEMO_MODE === "true";
const DEMO_PASSWORD =
  import.meta.env.VITE_DEMO_PASSWORD || "";

const DEMO_ACCOUNTS = [
  { label: "Administrator", username: "demo_admin" },
  { label: "Purchasing", username: "demo_purchasing" },
  { label: "Warehouse", username: "demo_warehouse" },
  { label: "Sales", username: "demo_sales" },
  { label: "Finance", username: "demo_finance" },
  { label: "Manager", username: "demo_manager" },
];

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
  const [activeDemoAccount, setActiveDemoAccount] =
    useState("");
  const [errorMessage, setErrorMessage] =
    useState("");

  const finishLogin = async (
    loginIdentifier,
    loginPassword,
  ) => {
    await login(loginIdentifier, loginPassword);

    const destination =
      location.state?.from?.pathname || "/";

    navigate(destination, { replace: true });
  };

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
      await finishLogin(identifier.trim(), password);
    } catch (error) {
      setErrorMessage(
        error.response?.data?.message ||
          "Login gagal. Pastikan backend aktif dan coba kembali.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDemoLogin = async (account) => {
    setErrorMessage("");

    if (!DEMO_PASSWORD) {
      setErrorMessage(
        "Credential live demo belum dikonfigurasi.",
      );
      return;
    }

    try {
      setIsSubmitting(true);
      setActiveDemoAccount(account.username);
      await finishLogin(account.username, DEMO_PASSWORD);
    } catch (error) {
      setErrorMessage(
        error.response?.data?.message ||
          "Akun demo gagal digunakan. Coba kembali.",
      );
    } finally {
      setIsSubmitting(false);
      setActiveDemoAccount("");
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
          <h1>Kelola seluruh proses bisnis dalam satu tempat.</h1>
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
                  type={showPassword ? "text" : "password"}
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

            {!IS_DEMO_MODE && (
              <div
                style={{
                  textAlign: "right",
                  marginTop: "-10px",
                }}
              >
                <Link to="/forgot-password">
                  Lupa password?
                </Link>
              </div>
            )}

            <button
              type="submit"
              className="login-submit"
              disabled={isSubmitting}
            >
              {isSubmitting && !activeDemoAccount && (
                <LoaderCircle
                  className="login-spinner"
                  aria-hidden="true"
                />
              )}
              {isSubmitting && !activeDemoAccount
                ? "Memproses..."
                : "Masuk"}
            </button>
          </form>

          {IS_DEMO_MODE && (
            <section
              className="demo-login-panel"
              aria-labelledby="demo-login-title"
            >
              <div className="demo-login-divider">
                <span>atau</span>
              </div>

              <div className="demo-login-heading">
                <div>
                  <strong id="demo-login-title">
                    Coba Live Demo
                  </strong>
                  <span>
                    Masuk satu klik menggunakan role yang ingin diuji.
                  </span>
                </div>
                <PlayCircle aria-hidden="true" />
              </div>

              <div className="demo-login-grid">
                {DEMO_ACCOUNTS.map((account) => (
                  <button
                    type="button"
                    key={account.username}
                    disabled={isSubmitting}
                    onClick={() => handleDemoLogin(account)}
                  >
                    {activeDemoAccount === account.username ? (
                      <LoaderCircle
                        className="login-spinner"
                        aria-hidden="true"
                      />
                    ) : null}
                    <span>{account.label}</span>
                  </button>
                ))}
              </div>

              <p className="demo-login-note">
                Data demo digunakan bersama oleh pengunjung dan
                akan dikembalikan ke kondisi awal secara berkala.
              </p>
            </section>
          )}

          <p className="login-footer">
            {IS_DEMO_MODE
              ? "Live demo menggunakan data simulasi, bukan data produksi."
              : "Akses sistem diberikan oleh administrator."}
          </p>
        </div>
      </section>
    </main>
  );
};

export default LoginPage;
