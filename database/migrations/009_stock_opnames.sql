BEGIN;

CREATE TABLE IF NOT EXISTS app.stock_opnames (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    opname_number VARCHAR(40) NOT NULL UNIQUE,
    opname_date DATE DEFAULT CURRENT_DATE NOT NULL,
    status VARCHAR(20) DEFAULT 'DRAFT' NOT NULL,
    notes TEXT,
    created_by UUID REFERENCES app.users(id) ON DELETE SET NULL,
    submitted_by UUID REFERENCES app.users(id) ON DELETE SET NULL,
    submitted_at TIMESTAMPTZ,
    decided_by UUID REFERENCES app.users(id) ON DELETE SET NULL,
    decided_at TIMESTAMPTZ,
    rejection_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    CONSTRAINT stock_opnames_status_check
        CHECK (status IN ('DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'))
);

CREATE TABLE IF NOT EXISTS app.stock_opname_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    stock_opname_id UUID NOT NULL REFERENCES app.stock_opnames(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES app.products(id),
    system_quantity NUMERIC(18,3) NOT NULL,
    counted_quantity NUMERIC(18,3) NOT NULL,
    notes VARCHAR(300),
    CONSTRAINT stock_opname_items_product_unique UNIQUE (stock_opname_id, product_id),
    CONSTRAINT stock_opname_items_system_quantity_check CHECK (system_quantity >= 0),
    CONSTRAINT stock_opname_items_counted_quantity_check CHECK (counted_quantity >= 0)
);

ALTER TABLE app.transaction_approvals
    DROP CONSTRAINT IF EXISTS transaction_approvals_type_check;

ALTER TABLE app.transaction_approvals
    ADD CONSTRAINT transaction_approvals_type_check
    CHECK (transaction_type IN ('PURCHASE_ORDER', 'SALES_ORDER', 'STOCK_OPNAME'));

INSERT INTO app.code_number_settings (
    module_key, module_label, field_name, is_automatic, prefix,
    separator, digit_length, include_year, include_month,
    reset_rule, last_number, last_period
)
VALUES (
    'STOCK_OPNAME', 'Stock Opname', 'opname_number', TRUE, 'SOF',
    '-', 4, TRUE, FALSE, 'YEARLY', 0, TO_CHAR(CURRENT_DATE, 'YYYY')
)
ON CONFLICT (module_key) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_stock_opnames_date
    ON app.stock_opnames(opname_date DESC);
CREATE INDEX IF NOT EXISTS idx_stock_opnames_status
    ON app.stock_opnames(status);
CREATE INDEX IF NOT EXISTS idx_stock_opname_items_product
    ON app.stock_opname_items(product_id);

DROP TRIGGER IF EXISTS trg_stock_opnames_updated_at ON app.stock_opnames;
CREATE TRIGGER trg_stock_opnames_updated_at
    BEFORE UPDATE ON app.stock_opnames
    FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();

COMMIT;
