const getAllowedOrigins = () => {
  const configured = [
    process.env.FRONTEND_URL,
    ...(process.env.CORS_ORIGINS || "").split(","),
  ];

  if (process.env.NODE_ENV !== "production") {
    configured.push("http://localhost:5173");
  }

  return new Set(
    configured
      .map((value) => value?.trim().replace(/\/$/, ""))
      .filter(Boolean),
  );
};

const corsMiddleware = (req, res, next) => {
  const origin = req.headers.origin;

  if (!origin) {
    return next();
  }

  const normalizedOrigin = origin.replace(/\/$/, "");
  const allowedOrigins = getAllowedOrigins();

  if (!allowedOrigins.has(normalizedOrigin)) {
    return res.status(403).json({
      success: false,
      message: "Origin is not allowed",
    });
  }

  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Vary", "Origin");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Authorization, Content-Type",
  );
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  );

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  return next();
};

module.exports = corsMiddleware;
