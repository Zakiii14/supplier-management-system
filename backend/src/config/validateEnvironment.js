const validateEnvironment = () => {
  const errors = [];
  const isProduction = process.env.NODE_ENV === "production";
  const jwtSecret = process.env.JWT_SECRET || "";
  const emailProvider = (process.env.EMAIL_PROVIDER || "console").toLowerCase();
  const frontendUrl = process.env.FRONTEND_URL || "";

  if (!jwtSecret) {
    errors.push("JWT_SECRET is required");
  }

  if (isProduction && jwtSecret.length < 32) {
    errors.push("JWT_SECRET must contain at least 32 characters in production");
  }

  if (isProduction && !frontendUrl) {
    errors.push("FRONTEND_URL is required in production");
  }

  if (
    isProduction &&
    frontendUrl &&
    !frontendUrl.startsWith("https://")
  ) {
    errors.push("FRONTEND_URL must use HTTPS in production");
  }

  if (isProduction && emailProvider === "console") {
    errors.push("EMAIL_PROVIDER cannot be console in production");
  }

  if (emailProvider === "resend") {
    if (!process.env.RESEND_API_KEY) {
      errors.push("RESEND_API_KEY is required when EMAIL_PROVIDER=resend");
    }

    if (!process.env.EMAIL_FROM) {
      errors.push("EMAIL_FROM is required when EMAIL_PROVIDER=resend");
    }
  }

  if (!["console", "resend"].includes(emailProvider)) {
    errors.push(`Unsupported EMAIL_PROVIDER: ${emailProvider}`);
  }

  if (errors.length > 0) {
    throw new Error(
      `Invalid environment configuration:\n- ${errors.join("\n- ")}`,
    );
  }
};

module.exports = validateEnvironment;
