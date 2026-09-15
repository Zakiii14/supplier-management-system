const DEFAULT_FROM = "SupplyFlow <no-reply@supplyflow.local>";

const getFrontendBaseUrl = () =>
  (process.env.FRONTEND_URL || "http://localhost:5173").replace(/\/$/, "");

const sendEmail = async ({ to, subject, html, text }) => {
  if (!to) {
    throw new Error("Email recipient is required");
  }

  const provider = (process.env.EMAIL_PROVIDER || "console").toLowerCase();

  if (provider === "console") {
    console.log("[EMAIL:console]", {
      to,
      subject,
      text,
    });

    return { provider: "console" };
  }

  if (provider !== "resend") {
    throw new Error(`Unsupported EMAIL_PROVIDER: ${provider}`);
  }

  if (!process.env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY is not configured");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM || DEFAULT_FROM,
      to: [to],
      subject,
      html,
      text,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Failed to send email: ${response.status} ${detail}`);
  }

  return response.json();
};

const sendAccountActivationEmail = async ({
  email,
  fullName,
  token,
  expiresAt,
}) => {
  const activationUrl = `${getFrontendBaseUrl()}/activate-account?token=${encodeURIComponent(token)}`;
  const expiryText = new Date(expiresAt).toLocaleString("id-ID", {
    timeZone: "Asia/Jakarta",
  });

  return sendEmail({
    to: email,
    subject: "Aktifkan akun SupplyFlow Anda",
    text: `Halo ${fullName},\n\nAnda diundang menggunakan SupplyFlow. Aktifkan akun dan buat password melalui tautan berikut:\n${activationUrl}\n\nTautan berlaku sampai ${expiryText}.`,
    html: `
      <p>Halo ${fullName},</p>
      <p>Anda diundang menggunakan <strong>SupplyFlow</strong>.</p>
      <p><a href="${activationUrl}">Aktifkan akun dan buat password</a></p>
      <p>Tautan berlaku sampai ${expiryText}.</p>
      <p>Jika Anda tidak merasa menerima undangan ini, abaikan email ini.</p>
    `,
  });
};

const sendPasswordResetEmail = async ({
  email,
  fullName,
  token,
  expiresAt,
}) => {
  const resetUrl = `${getFrontendBaseUrl()}/reset-password?token=${encodeURIComponent(token)}`;
  const expiryText = new Date(expiresAt).toLocaleString("id-ID", {
    timeZone: "Asia/Jakarta",
  });

  return sendEmail({
    to: email,
    subject: "Reset password SupplyFlow",
    text: `Halo ${fullName},\n\nKami menerima permintaan reset password SupplyFlow. Buat password baru melalui tautan berikut:\n${resetUrl}\n\nTautan berlaku sampai ${expiryText}. Jika Anda tidak meminta reset password, abaikan email ini.`,
    html: `
      <p>Halo ${fullName},</p>
      <p>Kami menerima permintaan reset password <strong>SupplyFlow</strong>.</p>
      <p><a href="${resetUrl}">Buat password baru</a></p>
      <p>Tautan berlaku sampai ${expiryText}.</p>
      <p>Jika Anda tidak meminta reset password, abaikan email ini.</p>
    `,
  });
};

module.exports = {
  sendAccountActivationEmail,
  sendPasswordResetEmail,
};
