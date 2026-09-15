const createRateLimiter = ({
  windowMs = 15 * 60 * 1000,
  max = 20,
  message = "Too many requests. Please try again later.",
  keyGenerator = (req) => req.ip || req.socket?.remoteAddress || "unknown",
} = {}) => {
  const hits = new Map();

  return (req, res, next) => {
    const now = Date.now();
    const key = keyGenerator(req);
    const current = hits.get(key);

    if (!current || current.resetAt <= now) {
      hits.set(key, {
        count: 1,
        resetAt: now + windowMs,
      });
      return next();
    }

    current.count += 1;

    if (current.count > max) {
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((current.resetAt - now) / 1000),
      );

      res.setHeader("Retry-After", String(retryAfterSeconds));
      return res.status(429).json({
        success: false,
        message,
      });
    }

    if (hits.size > 10000) {
      for (const [storedKey, entry] of hits) {
        if (entry.resetAt <= now) {
          hits.delete(storedKey);
        }
      }
    }

    return next();
  };
};

module.exports = createRateLimiter;
