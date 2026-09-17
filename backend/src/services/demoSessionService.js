const pool = require("../config/database");
const {
  resetDemoDatabase,
} = require("../demo/demoResetService");

const configuredIdleMinutes = Number.parseInt(
  process.env.DEMO_IDLE_MINUTES || "15",
  10,
);
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
  const clientId = String(value || "").trim();
  if (!UUID_PATTERN.test(clientId)) {
    const error = new Error("Demo client id tidak valid.");
    error.code = "INVALID_DEMO_CLIENT_ID";
    throw error;
  }
  return clientId;
};

const touchDemoSession = async ({
  clientId,
  userId,
  client = pool,
}) => {
  if (!isDemoMode()) return { tracked: false };

  const normalizedClientId = normalizeClientId(clientId);

  await client.query(
    `
    INSERT INTO app.demo_sessions (
      client_id,
      user_id,
      created_at,
      last_seen_at,
      ended_at
    )
    VALUES ($1, $2, NOW(), NOW(), NULL)
    ON CONFLICT (client_id)
    DO UPDATE SET
      user_id = EXCLUDED.user_id,
      last_seen_at = NOW(),
      ended_at = NULL
    `,
    [normalizedClientId, userId],
  );

  return { tracked: true, clientId: normalizedClientId };
};

const hasRecentActiveSessions = async (client) => {
  const result = await client.query(
    `
    SELECT EXISTS (
      SELECT 1
      FROM app.demo_sessions
      WHERE ended_at IS NULL
        AND last_seen_at > NOW() - ($1::int * INTERVAL '1 minute')
    ) AS has_active
    `,
    [DEMO_IDLE_MINUTES],
  );

  return Boolean(result.rows[0]?.has_active);
};

const hasTrackedSessions = async (client) => {
  const result = await client.query(
    "SELECT EXISTS (SELECT 1 FROM app.demo_sessions) AS has_sessions",
  );
  return Boolean(result.rows[0]?.has_sessions);
};

const maybeResetStaleDemo = async ({ reason = "idle" } = {}) => {
  if (!isDemoResetEnabled()) {
    return { reset: false, reason: "disabled" };
  }

  const client = await pool.connect();
  try {
    const hasSessions = await hasTrackedSessions(client);
    if (!hasSessions) {
      return { reset: false, reason: "no_tracked_session" };
    }

    const hasActive = await hasRecentActiveSessions(client);
    if (hasActive) {
      return { reset: false, reason: "active_session" };
    }

    const result = await resetDemoDatabase({
      client,
      clearStorage: true,
    });

    return {
      reset: true,
      reason,
      databaseName: result.databaseName,
    };
  } finally {
    client.release();
  }
};

const endDemoSession = async ({ clientId, userId }) => {
  if (!isDemoMode()) {
    return { ended: false, reset: false, reason: "not_demo" };
  }

  const normalizedClientId = normalizeClientId(clientId);

  await pool.query(
    `
    UPDATE app.demo_sessions
    SET ended_at = NOW(), last_seen_at = NOW()
    WHERE client_id = $1
      AND user_id = $2
    `,
    [normalizedClientId, userId],
  );

  const resetResult = await maybeResetStaleDemo({
    reason: "session_ended",
  });

  return {
    ended: true,
    ...resetResult,
  };
};

module.exports = {
  DEMO_IDLE_MINUTES,
  endDemoSession,
  isDemoMode,
  isDemoResetEnabled,
  maybeResetStaleDemo,
  normalizeClientId,
  touchDemoSession,
};
