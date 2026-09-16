const isDemoMode = () =>
  String(process.env.DEMO_MODE || "")
    .trim()
    .toLowerCase() === "true";

const blockDemoMutation = (req, res, next) => {
  if (!isDemoMode()) {
    return next();
  }

  return res.status(403).json({
    success: false,
    message:
      "Fitur ini dinonaktifkan pada mode demo publik agar data dan akun demo tetap aman.",
  });
};

module.exports = {
  isDemoMode,
  blockDemoMutation,
};
