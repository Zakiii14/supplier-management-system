const crypto = require("node:crypto");

const pool = require("../config/database");

const TOKEN_TYPES = {
  ACCOUNT_ACTIVATION: "ACCOUNT_ACTIVATION",
  PASSWORD_RESET: "PASSWORD_RESET",
};

const TOKEN_TTL_MINUTES = {
  ACCOUNT_ACTIVATION: 24 * 60,
  PASSWORD_RESET: 30,
};

const hashToken = (token) =>
  crypto.createHash("sha256").update(token).digest("hex");

const createAuthToken = async ({
  userId,
  tokenType,
  createdBy = null,
}) => {
  if (!TOKEN_TTL_MINUTES[tokenType]) {
    throw new Error("Unsupported auth token type");
  }

  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashToken(token);
  const ttlMinutes = TOKEN_TTL_MINUTES[tokenType];

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await client.query(
      `
      UPDATE app.auth_tokens
      SET used_at = NOW()
      WHERE user_id = $1
        AND token_type = $2::app.auth_token_type
        AND used_at IS NULL
      `,
      [userId, tokenType],
    );

    const result = await client.query(
      `
      INSERT INTO app.auth_tokens (
        user_id,
        token_hash,
        token_type,
        expires_at,
        created_by
      )
      VALUES (
        $1,
        $2,
        $3::app.auth_token_type,
        NOW() + ($4::TEXT || ' minutes')::INTERVAL,
        $5
      )
      RETURNING expires_at
      `,
      [userId, tokenHash, tokenType, ttlMinutes, createdBy],
    );

    await client.query("COMMIT");

    return {
      token,
      expiresAt: result.rows[0].expires_at,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

const findValidAuthToken = async ({ token, tokenType }) => {
  if (!token || !TOKEN_TTL_MINUTES[tokenType]) {
    return null;
  }

  const result = await pool.query(
    `
    SELECT
      t.id,
      t.user_id,
      t.expires_at,
      u.username,
      u.full_name,
      u.email,
      u.role,
      u.status,
      u.password_hash,
      u.email_verified_at
    FROM app.auth_tokens t
    JOIN app.users u ON u.id = t.user_id
    WHERE t.token_hash = $1
      AND t.token_type = $2::app.auth_token_type
      AND t.used_at IS NULL
      AND t.expires_at > NOW()
    LIMIT 1
    `,
    [hashToken(token), tokenType],
  );

  return result.rows[0] || null;
};

const consumeAuthToken = async ({
  tokenId,
  userId,
  passwordHash,
  verifyEmail = false,
}) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const tokenResult = await client.query(
      `
      UPDATE app.auth_tokens
      SET used_at = NOW()
      WHERE id = $1
        AND user_id = $2
        AND used_at IS NULL
        AND expires_at > NOW()
      RETURNING id
      `,
      [tokenId, userId],
    );

    if (tokenResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return false;
    }

    await client.query(
      `
      UPDATE app.users
      SET
        password_hash = $1,
        password_changed_at = NOW(),
        email_verified_at = CASE
          WHEN $2::BOOLEAN THEN COALESCE(email_verified_at, NOW())
          ELSE email_verified_at
        END,
        status = CASE
          WHEN $2::BOOLEAN THEN 'ACTIVE'::app.record_status
          ELSE status
        END,
        updated_at = NOW()
      WHERE id = $3
      `,
      [passwordHash, verifyEmail, userId],
    );

    await client.query(
      `
      UPDATE app.auth_tokens
      SET used_at = COALESCE(used_at, NOW())
      WHERE user_id = $1
        AND used_at IS NULL
      `,
      [userId],
    );

    await client.query("COMMIT");
    return true;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

module.exports = {
  TOKEN_TYPES,
  createAuthToken,
  findValidAuthToken,
  consumeAuthToken,
};
