import { useState } from "react";
import {
  LoaderCircle,
  Mail,
  PackageCheck,
} from "lucide-react";
import { Link } from "react-router-dom";

import { forgotPasswordRequest } from "../api/auth";
import "../styles/login.css";

const SUCCESS_TITLE = "Permintaan reset berhasil diproses.";

const ForgotPasswordPage = () => {
  const [email, setEmail] = useState("");
  const [submittedEmail, setSubmittedEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();
    setMessage("");
    setErrorMessage("");

    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      setErrorMessage("Email wajib diisi.");
      return;
    }

    try {
      setIsSubmitting(true);
      const response = await forgotPasswordRequest(normalizedEmail);
      setSubmittedEmail(normalizedEmail);
      setMessage(
        response.message ||
          "Jika email tersebut terdaftar dan akun aktif, tautan reset akan dikirim. Periksa Kotak Masuk dan folder Spam.",
      );
    } catch (error) {
      setErrorMessage(
        error.response?.data?.message ||
          "Permintaan reset password gagal diproses. Silakan coba lagi.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUseAnotherEmail = () => {
    setMessage("");
    setSubmittedEmail("");
    setErrorMessage("");
    setEmail("");
  };

  const successDetail = message.startsWith(SUCCESS_TITLE)
    ? message.slice(SUCCESS_TITLE.length).trim()
    : message;

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
            <p>Kami akan memproses permintaan reset untuk email akun Anda.</p>
          </div>

          {message ? (
            <>
              <div className="login-success" role="status">
                <strong>{SUCCESS_TITLE}</strong>
                {successDetail && <p>{successDetail}</p>}
                {submittedEmail && (
                  <p className="login-success-email">
                    Email yang dimasukkan: <strong>{submittedEmail}</strong>
                  </p>
                )}
                <p>
                  Jika email belum diterima, periksa folder Spam,
                  pastikan alamat email benar, atau hubungi administrator.
                </p>
              </div>

              <button
                type="button"
                className="login-submit"
                onClick={handleUseAnotherEmail}
              >
                Gunakan email lain
              </button>
            </>
          ) : (
            <form onSubmit={handleSubmit}>
              {errorMessage && (
                <div className="login-error" role="alert">
                  {errorMessage}
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
                {isSubmitting ? "Memproses..." : "Kirim tautan reset"}
              </button>
            </form>
          )}

          <p className="login-footer">
            <Link to="/login">Kembali ke halaman login</Link>
          </p>
        </div>
      </section>
    </main>
  );
};

export default ForgotPasswordPage;
