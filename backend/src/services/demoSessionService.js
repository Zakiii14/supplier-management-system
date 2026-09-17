const { randomUUID } = require("node:crypto");
const pool = require("../config/database");
const { resetDemoDatabase } = require("../demo/demoResetService");
const { withDemoTransaction } = require("../demo/demoTransaction");

const configuredIdleMinutes = Number(process.env.DEMO_IDLE_MINUTES || "15");
const DEMO_IDLE_MINUTES =
  Number.isInteger(configuredIdleMinutes) && configuredIdleMinutes > 0
    ? configuredIdleMinutes
    : 15;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const isDemoMode = () => process.env.DEMO_MODE === "true";
const isDemoResetEnabled = () =>
  isDemoMode() && process.env.DEMO_RESET_ENABLED === "true";

const normalizeClientId = (value) => {
  if (typeof value !== "string" || !UUID_PATTERN.test(value.trim())) {
    const error = new Error("Demo client id tidak valid.");
    error.code = "INVALID_DEMO_CLIENT_ID";
    error.statusCode = 400;
    throw error;
  }
  return value.trim().toLowerCase();
};

const expiredSession = () => {
  const error = new Error("Sesi demo sudah berakhir. Silakan login kembali.");
  error.statusCode = 401;
  return error;
};

// Called only by successful login, inside the same locked transaction as
// credential verification. A new generation invalidates delayed old requests.
const startDemoSession = async ({ client, clientId, userId }) => {
  const sessionId = randomUUID();
  await client.query(
    `INSERT INTO app.demo_sessions
       (client_id, session_id, user_id, created_at, last_seen_at, ended_at)
     VALUES ($1, $2, $3, clock_timestamp(), clock_timestamp(), NULL)
     ON CONFLICT (client_id) DO UPDATE SET
       session_id = EXCLUDED.session_id, user_id = EXCLUDED.user_id,
       created_at = clock_timestamp(), last_seen_at = clock_timestamp(), ended_at = NULL`,
    [normalizeClientId(clientId), sessionId, userId],
  );
  return sessionId;
};

const isActiveDemoSession = async ({ client = pool, clientId, sessionId, userId }) => {
  if (!UUID_PATTERN.test(clientId || "") || !UUID_PATTERN.test(sessionId || "")) {
    return false;
  }
  const result = await client.query(
    `SELECT 1 FROM app.demo_sessions
     WHERE client_id = $1 AND session_id = $2 AND user_id = $3
       AND ended_at IS NULL
       AND last_seen_at > clock_timestamp() - ($4::int * INTERVAL '1 minute')`,
    [clientId, sessionId, userId, DEMO_IDLE_MINUTES],
  );
  return result.rowCount === 1;
};

const touchDemoSession = async ({ clientId, sessionId, userId }) => {
  if (!isDemoMode()) return { tracked: false };
  const normalizedClientId = normalizeClientId(clientId);
  return withDemoTransaction(async (client) => {
    const result = await client.query(
      `UPDATE app.demo_sessions SET last_seen_at = clock_timestamp()
       WHERE client_id = $1 AND session_id = $2 AND user_id = $3
         AND ended_at IS NULL
         AND last_seen_at > clock_timestamp() - ($4::int * INTERVAL '1 minute')`,
      [normalizedClientId, sessionId, userId, DEMO_IDLE_MINUTES],
    );
    if (result.rowCount !== 1) throw expiredSession();
    return { tracked: true };
  });
};

const maybeResetStaleDemo = async ({ reason = "idle" } = {}) => {
  if (!isDemoResetEnabled()) return { reset: false, reason: "disabled" };
  const client = await pool.connect();
  try {
    const result = await resetDemoDatabase({
      client,
      clearStorage: true,
      shouldReset: async (lockedClient) => {
        const { rows: [state] } = await lockedClient.query(
          `SELECT
            EXISTS (SELECT 1 FROM app.demo_sessions) AS has_sessions,
            EXISTS (SELECT 1 FROM app.demo_sessions
              WHERE ended_at IS NULL AND last_seen_at >
                clock_timestamp() - ($1::int * INTERVAL '1 minute')) AS has_active`,
          [DEMO_IDLE_MINUTES],
        );
        if (!state.has_sessions) return { reset: false, reason: "no_tracked_session" };
        if (state.has_active) return { reset: false, reason: "active_session" };
        return { reset: true };
      },
    });
    if (!result.reset) return result;
    return {
      reset: true,
      reason,
      storageCleanupFailed: Boolean(result.storageCleanupFailed),
    };
  } finally {
    client.release();
  }
};

const endDemoSession = async ({ clientId, sessionId, userId }) => {
  if (!isDemoMode()) return { ended: false, reset: false, reason: "not_demo" };
  const normalizedClientId = normalizeClientId(clientId);
  const ended = await withDemoTransaction(async (client) => {
    const result = await client.query(
      `UPDATE app.demo_sessions SET ended_at = clock_timestamp()
       WHERE client_id = $1 AND session_id = $2 AND user_id = $3 AND ended_at IS NULL`,
      [normalizedClientId, sessionId, userId],
    );
    return result.rowCount === 1;
  });
  // A login/heartbeat in this gap is safe: reset rechecks under the same lock.
  const result = await maybeResetStaleDemo({ reason: "session_ended" });
  return { ended, ...result };
};

module.exports = {
  DEMO_IDLE_MINUTES,
  endDemoSession,
  expiredSession,
  isActiveDemoSession,
  isDemoMode,
  isDemoResetEnabled,
  maybeResetStaleDemo,
  normalizeClientId,
  startDemoSession,
  touchDemoSession,
};
