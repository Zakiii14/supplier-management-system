BEGIN;

CREATE TABLE IF NOT EXISTS app.tax_settings (
    id SMALLINT DEFAULT 1 PRIMARY KEY,
    is_enabled BOOLEAN DEFAULT TRUE NOT NULL,
    tax_name VARCHAR(40) DEFAULT 'PPN' NOT NULL,
    default_rate NUMERIC(5,2) DEFAULT 0 NOT NULL,
    allow_invoice_override BOOLEAN DEFAULT TRUE NOT NULL,
    updated_by UUID REFERENCES app.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    CONSTRAINT tax_settings_singleton_check CHECK (id = 1),
    CONSTRAINT tax_settings_name_check CHECK (BTRIM(tax_name) <> ''),
    CONSTRAINT tax_settings_rate_check CHECK (default_rate >= 0 AND default_rate <= 100)
);

INSERT INTO app.tax_settings (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

DROP TRIGGER IF EXISTS trg_tax_settings_updated_at ON app.tax_settings;
CREATE TRIGGER trg_tax_settings_updated_at
BEFORE UPDATE ON app.tax_settings
FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();

COMMIT;
