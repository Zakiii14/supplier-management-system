import { useState } from "react";
import {
  LoaderCircle,
  Mail,
  PackageCheck,
} from "lucide-react";
import { Link } from "react-router-dom";

import { forgotPasswordRequest } from "../api/auth";
import "../styles/login.css";

const ForgotPasswordPage = () => {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();
    setMessage("");
    setErrorMessage("");

    if (!email.trim()) {
      setErrorMessage("Email wajib diisi.");
      return;
    }

    try {
      setIsSubmitting(true);
      const response = await forgotPasswordRequest(
        email.trim().toLowerCase(),
      );
      setMessage(
        response.message ||
          "Jika email terdaftar, instruksi reset password akan dikirim.",
      );
    } catch (error) {
      setErrorMessage(
        error.response?.data?.message ||
          "Permintaan reset password gagal diproses.",
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
          <p className="login-eyebrow">Keamanan akun</p>
          <h1>Atur ulang akses akun dengan aman.</h1>
          <p>
            Masukkan email yang terdaftar. Tautan reset password
            hanya dapat digunakan sekali dan memiliki masa berlaku.
          </p>
        </div>
      </section>

      <section className="login-form-panel">
        <div className="login-card">
          <div className="login-card-header">
            <h2>Lupa password</h2>
            <p>Kami akan mengirim tautan reset ke email akun Anda.</p>
          </div>

          <form onSubmit={handleSubmit}>
            {errorMessage && (
              <div className="login-error" role="alert">
                {errorMessage}
              </div>
            )}

            {message && (
              <div className="login-success" role="status">
                {message}
              </div>
            )}

            <label className="login-field">
              <span>Email</span>
              <div className="login-input-wrapper">
                <Mail aria-hidden="true" />
                <input
                  type="email"
                  value={email}
                  placeholder="nama@perusahaan.com"
                  autoComplete="email"
                  disabled={isSubmitting}
                  onChange={(event) => setEmail(event.target.value)}
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
              {isSubmitting ? "Mengirim..." : "Kirim tautan reset"}
            </button>
          </form>

          <p className="login-footer">
            <Link to="/login">Kembali ke halaman login</Link>
          </p>
        </div>
      </section>
    </main>
  );
};

export default ForgotPasswordPage;
