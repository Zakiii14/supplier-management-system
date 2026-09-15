DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_type t
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE n.nspname = 'app'
          AND t.typname = 'auth_token_type'
    ) THEN
        CREATE TYPE app.auth_token_type AS ENUM (
            'ACCOUNT_ACTIVATION',
            'PASSWORD_RESET'
        );
    END IF;
END
$$;

ALTER TABLE app.users
    ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS invited_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ;

-- Existing accounts are treated as already verified so this migration does not
-- unexpectedly lock users out after Authentication V2 is deployed.
UPDATE app.users
SET
    email_verified_at = COALESCE(email_verified_at, created_at),
    password_changed_at = COALESCE(password_changed_at, updated_at)
WHERE password_hash IS NOT NULL;

CREATE TABLE IF NOT EXISTS app.auth_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES app.users(id) ON DELETE CASCADE,
    token_hash CHAR(64) NOT NULL UNIQUE,
    token_type app.auth_token_type NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_by UUID REFERENCES app.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT auth_tokens_expiry_check CHECK (expires_at > created_at)
);

CREATE INDEX IF NOT EXISTS idx_auth_tokens_user_type_active
    ON app.auth_tokens (user_id, token_type, expires_at)
    WHERE used_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_auth_tokens_expiry
    ON app.auth_tokens (expires_at)
    WHERE used_at IS NULL;
