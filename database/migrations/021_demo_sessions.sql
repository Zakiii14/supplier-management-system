CREATE TABLE app.demo_sessions (
  client_id UUID PRIMARY KEY,
  session_id UUID NOT NULL,
  user_id UUID NOT NULL REFERENCES app.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ
);

CREATE INDEX demo_sessions_active_idx
  ON app.demo_sessions (last_seen_at DESC)
  WHERE ended_at IS NULL;
