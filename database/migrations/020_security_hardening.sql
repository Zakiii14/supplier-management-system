CREATE OR REPLACE FUNCTION app.set_password_changed_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF NEW.password_hash IS NOT NULL AND NEW.password_changed_at IS NULL THEN
            NEW.password_changed_at = NOW();
        END IF;
    ELSIF NEW.password_hash IS DISTINCT FROM OLD.password_hash THEN
        NEW.password_changed_at = NOW();
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_users_password_changed_at ON app.users;

CREATE TRIGGER trg_users_password_changed_at
BEFORE INSERT OR UPDATE ON app.users
FOR EACH ROW
EXECUTE FUNCTION app.set_password_changed_at();
