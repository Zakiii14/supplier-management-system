BEGIN;

CREATE TABLE IF NOT EXISTS app.notification_reads (
    user_id uuid NOT NULL REFERENCES app.users(id) ON DELETE CASCADE,
    notification_key varchar(180) NOT NULL,
    read_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, notification_key)
);

CREATE INDEX IF NOT EXISTS idx_notification_reads_user_time
    ON app.notification_reads(user_id, read_at DESC);

COMMIT;
