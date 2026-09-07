BEGIN;

CREATE TABLE IF NOT EXISTS app.payment_settings (
    id smallint PRIMARY KEY DEFAULT 1,
    default_purchase_scheme character varying(20) DEFAULT 'TERM' NOT NULL,
    default_purchase_term_days integer DEFAULT 0 NOT NULL,
    default_down_payment_percent numeric(5,2) DEFAULT 30 NOT NULL,
    require_purchase_transfer_proof boolean DEFAULT false NOT NULL,
    require_sales_transfer_proof boolean DEFAULT false NOT NULL,
    updated_by uuid REFERENCES app.users(id) ON DELETE SET NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT payment_settings_singleton_check CHECK (id = 1),
    CONSTRAINT payment_settings_scheme_check CHECK (
        default_purchase_scheme IN ('DIRECT', 'TERM', 'DOWN_PAYMENT', 'COD')
    ),
    CONSTRAINT payment_settings_term_days_check CHECK (
        default_purchase_term_days BETWEEN 0 AND 365
    ),
    CONSTRAINT payment_settings_down_payment_check CHECK (
        default_down_payment_percent BETWEEN 0 AND 100
    )
);

INSERT INTO app.payment_settings (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE app.suppliers
    ADD COLUMN IF NOT EXISTS payment_scheme character varying(20),
    ADD COLUMN IF NOT EXISTS down_payment_percent numeric(5,2);

DO $migration$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'app.suppliers'::regclass
          AND conname = 'suppliers_payment_scheme_check'
    ) THEN
        ALTER TABLE app.suppliers
            ADD CONSTRAINT suppliers_payment_scheme_check CHECK (
                payment_scheme IS NULL
                OR payment_scheme IN ('DIRECT', 'TERM', 'DOWN_PAYMENT', 'COD')
            );
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'app.suppliers'::regclass
          AND conname = 'suppliers_down_payment_percent_check'
    ) THEN
        ALTER TABLE app.suppliers
            ADD CONSTRAINT suppliers_down_payment_percent_check CHECK (
                down_payment_percent IS NULL
                OR down_payment_percent BETWEEN 0 AND 100
            );
    END IF;
END
$migration$;

ALTER TABLE app.purchase_orders
    ADD COLUMN IF NOT EXISTS payment_scheme character varying(20) DEFAULT 'TERM' NOT NULL,
    ADD COLUMN IF NOT EXISTS payment_terms_days integer DEFAULT 0 NOT NULL,
    ADD COLUMN IF NOT EXISTS down_payment_percent numeric(5,2) DEFAULT 0 NOT NULL;

UPDATE app.purchase_orders po
SET payment_terms_days = s.payment_terms_days
FROM app.suppliers s
WHERE s.id = po.supplier_id
  AND po.payment_terms_days = 0
  AND s.payment_terms_days > 0;

DO $migration$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'app.purchase_orders'::regclass
          AND conname = 'purchase_orders_payment_scheme_check'
    ) THEN
        ALTER TABLE app.purchase_orders
            ADD CONSTRAINT purchase_orders_payment_scheme_check CHECK (
                payment_scheme IN ('DIRECT', 'TERM', 'DOWN_PAYMENT', 'COD')
            );
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'app.purchase_orders'::regclass
          AND conname = 'purchase_orders_payment_terms_days_check'
    ) THEN
        ALTER TABLE app.purchase_orders
            ADD CONSTRAINT purchase_orders_payment_terms_days_check CHECK (
                payment_terms_days BETWEEN 0 AND 365
            );
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'app.purchase_orders'::regclass
          AND conname = 'purchase_orders_down_payment_percent_check'
    ) THEN
        ALTER TABLE app.purchase_orders
            ADD CONSTRAINT purchase_orders_down_payment_percent_check CHECK (
                down_payment_percent BETWEEN 0 AND 100
            );
    END IF;
END
$migration$;

CREATE TABLE IF NOT EXISTS app.supplier_payments (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    payment_number character varying(40) NOT NULL UNIQUE,
    purchase_order_id uuid NOT NULL REFERENCES app.purchase_orders(id) ON DELETE RESTRICT,
    payment_date date DEFAULT CURRENT_DATE NOT NULL,
    amount numeric(18,2) NOT NULL,
    method app.payment_method NOT NULL,
    reference_number character varying(100),
    supplier_invoice_number character varying(100),
    notes text,
    paid_by uuid REFERENCES app.users(id) ON DELETE SET NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT supplier_payments_amount_check CHECK (amount > 0)
);

CREATE TABLE IF NOT EXISTS app.payment_proofs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    customer_payment_id uuid REFERENCES app.payments(id) ON DELETE CASCADE,
    supplier_payment_id uuid REFERENCES app.supplier_payments(id) ON DELETE CASCADE,
    original_name character varying(255) NOT NULL,
    storage_name character varying(120) NOT NULL UNIQUE,
    mime_type character varying(100) NOT NULL,
    size_bytes bigint NOT NULL,
    checksum_sha256 character(64) NOT NULL,
    uploaded_by uuid REFERENCES app.users(id) ON DELETE SET NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT payment_proofs_owner_check CHECK (
        (customer_payment_id IS NOT NULL AND supplier_payment_id IS NULL)
        OR (customer_payment_id IS NULL AND supplier_payment_id IS NOT NULL)
    ),
    CONSTRAINT payment_proofs_size_check CHECK (size_bytes > 0)
);

CREATE INDEX IF NOT EXISTS idx_supplier_payments_purchase_order
    ON app.supplier_payments(purchase_order_id, payment_date DESC);

CREATE INDEX IF NOT EXISTS idx_payment_proofs_customer_payment
    ON app.payment_proofs(customer_payment_id)
    WHERE customer_payment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payment_proofs_supplier_payment
    ON app.payment_proofs(supplier_payment_id)
    WHERE supplier_payment_id IS NOT NULL;

DROP TRIGGER IF EXISTS trg_payment_settings_updated_at
ON app.payment_settings;

CREATE TRIGGER trg_payment_settings_updated_at
BEFORE UPDATE ON app.payment_settings
FOR EACH ROW
EXECUTE FUNCTION app.set_updated_at();

DROP TRIGGER IF EXISTS trg_supplier_payments_updated_at
ON app.supplier_payments;

CREATE TRIGGER trg_supplier_payments_updated_at
BEFORE UPDATE ON app.supplier_payments
FOR EACH ROW
EXECUTE FUNCTION app.set_updated_at();

DROP TRIGGER IF EXISTS trg_payment_proofs_updated_at
ON app.payment_proofs;

CREATE TRIGGER trg_payment_proofs_updated_at
BEFORE UPDATE ON app.payment_proofs
FOR EACH ROW
EXECUTE FUNCTION app.set_updated_at();

INSERT INTO app.code_number_settings (
    module_key,
    module_label,
    field_name,
    prefix,
    digit_length,
    include_year,
    include_month,
    reset_rule,
    last_period
)
VALUES (
    'SUPPLIER_PAYMENT',
    'Pembayaran Supplier',
    'payment_number',
    'SPAY',
    4,
    true,
    false,
    'YEARLY',
    TO_CHAR(CURRENT_DATE, 'YYYY')
)
ON CONFLICT (module_key) DO NOTHING;

COMMIT;
