BEGIN;
CREATE TABLE IF NOT EXISTS app.audit_logs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES app.users(id) ON DELETE SET NULL,
    username varchar(50),
    user_role varchar(30),
    action varchar(20) NOT NULL,
    module varchar(60) NOT NULL,
    entity_id varchar(120),
    entity_label varchar(180),
    request_method varchar(10) NOT NULL,
    request_path varchar(300) NOT NULL,
    previous_data jsonb,
    submitted_data jsonb,
    result_data jsonb,
    ip_address varchar(80),
    user_agent varchar(500),
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON app.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON app.audit_logs(user_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_module ON app.audit_logs(module,created_at DESC);
COMMIT;
