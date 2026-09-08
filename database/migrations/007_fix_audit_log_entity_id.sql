BEGIN;

ALTER TABLE app.audit_logs
    ALTER COLUMN entity_id TYPE varchar(120)
    USING entity_id::text;

COMMIT;
