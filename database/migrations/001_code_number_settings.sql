BEGIN;

CREATE TABLE IF NOT EXISTS app.code_number_settings (
    module_key character varying(40) PRIMARY KEY,
    module_label character varying(100) NOT NULL,
    field_name character varying(50) NOT NULL,
    is_automatic boolean DEFAULT false NOT NULL,
    prefix character varying(12) NOT NULL,
    separator character varying(3) DEFAULT '-'::character varying NOT NULL,
    digit_length smallint DEFAULT 4 NOT NULL,
    include_year boolean DEFAULT false NOT NULL,
    include_month boolean DEFAULT false NOT NULL,
    reset_rule character varying(10) DEFAULT 'NEVER'::character varying NOT NULL,
    last_number bigint DEFAULT 0 NOT NULL,
    last_period character varying(10) DEFAULT 'GLOBAL'::character varying NOT NULL,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT code_number_settings_digit_length_check
        CHECK (digit_length BETWEEN 1 AND 10),
    CONSTRAINT code_number_settings_last_number_check
        CHECK (last_number >= 0),
    CONSTRAINT code_number_settings_prefix_check
        CHECK (prefix ~ '^[A-Z0-9]+$'),
    CONSTRAINT code_number_settings_reset_rule_check
        CHECK (reset_rule IN ('NEVER', 'YEARLY', 'MONTHLY')),
    CONSTRAINT code_number_settings_separator_check
        CHECK (separator IN ('', '-', '/', '.')),
    CONSTRAINT code_number_settings_month_requires_year_check
        CHECK (NOT include_month OR include_year),
    CONSTRAINT code_number_settings_reset_tokens_check
        CHECK (
            reset_rule = 'NEVER'
            OR (reset_rule = 'YEARLY' AND include_year)
            OR (
                reset_rule = 'MONTHLY'
                AND include_year
                AND include_month
            )
        ),
    CONSTRAINT code_number_settings_updated_by_fkey
        FOREIGN KEY (updated_by)
        REFERENCES app.users(id)
        ON DELETE SET NULL
);

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
VALUES
    ('SUPPLIER', 'Supplier', 'supplier_code', 'SUP', 4, false, false, 'NEVER', 'GLOBAL'),
    ('CATEGORY', 'Kategori', 'category_code', 'CAT', 4, false, false, 'NEVER', 'GLOBAL'),
    ('PRODUCT', 'Produk', 'sku', 'SKU', 5, false, false, 'NEVER', 'GLOBAL'),
    ('PURCHASE_ORDER', 'Purchase Order', 'po_number', 'PO', 4, true, false, 'YEARLY', TO_CHAR(CURRENT_DATE, 'YYYY')),
    ('GOODS_RECEIPT', 'Goods Receipt', 'receipt_number', 'GR', 4, true, false, 'YEARLY', TO_CHAR(CURRENT_DATE, 'YYYY')),
    ('CUSTOMER', 'Pelanggan', 'customer_code', 'CUS', 4, false, false, 'NEVER', 'GLOBAL'),
    ('SALES_ORDER', 'Sales Order', 'so_number', 'SO', 4, true, false, 'YEARLY', TO_CHAR(CURRENT_DATE, 'YYYY')),
    ('DELIVERY', 'Delivery', 'delivery_number', 'DEL', 4, true, false, 'YEARLY', TO_CHAR(CURRENT_DATE, 'YYYY')),
    ('INVOICE', 'Invoice', 'invoice_number', 'INV', 4, true, false, 'YEARLY', TO_CHAR(CURRENT_DATE, 'YYYY')),
    ('PAYMENT', 'Pembayaran', 'payment_number', 'PAY', 4, true, false, 'YEARLY', TO_CHAR(CURRENT_DATE, 'YYYY'))
ON CONFLICT (module_key) DO NOTHING;

DROP TRIGGER IF EXISTS trg_code_number_settings_updated_at
ON app.code_number_settings;

CREATE TRIGGER trg_code_number_settings_updated_at
BEFORE UPDATE ON app.code_number_settings
FOR EACH ROW
EXECUTE FUNCTION app.set_updated_at();

COMMIT;
