BEGIN;

CREATE TABLE IF NOT EXISTS app.purchase_returns (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    return_number VARCHAR(40) NOT NULL UNIQUE,
    goods_receipt_id UUID NOT NULL REFERENCES app.goods_receipts(id) ON DELETE RESTRICT,
    return_date DATE DEFAULT CURRENT_DATE NOT NULL,
    status VARCHAR(20) DEFAULT 'DRAFT' NOT NULL,
    reason VARCHAR(50) NOT NULL,
    notes TEXT,
    created_by UUID REFERENCES app.users(id) ON DELETE SET NULL,
    submitted_by UUID REFERENCES app.users(id) ON DELETE SET NULL,
    submitted_at TIMESTAMPTZ,
    decided_by UUID REFERENCES app.users(id) ON DELETE SET NULL,
    decided_at TIMESTAMPTZ,
    rejection_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    CONSTRAINT purchase_returns_status_check
        CHECK (status IN ('DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'CANCELLED')),
    CONSTRAINT purchase_returns_reason_check
        CHECK (reason IN ('DAMAGED', 'WRONG_ITEM', 'QUALITY_ISSUE', 'EXCESS', 'OTHER'))
);

CREATE TABLE IF NOT EXISTS app.purchase_return_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    purchase_return_id UUID NOT NULL REFERENCES app.purchase_returns(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES app.products(id) ON DELETE RESTRICT,
    quantity NUMERIC(18,3) NOT NULL,
    unit_price NUMERIC(18,2) NOT NULL,
    item_condition VARCHAR(30) DEFAULT 'DAMAGED' NOT NULL,
    notes VARCHAR(300),
    CONSTRAINT purchase_return_items_product_unique UNIQUE (purchase_return_id, product_id),
    CONSTRAINT purchase_return_items_quantity_check CHECK (quantity > 0),
    CONSTRAINT purchase_return_items_unit_price_check CHECK (unit_price >= 0),
    CONSTRAINT purchase_return_items_condition_check
        CHECK (item_condition IN ('DAMAGED', 'WRONG_ITEM', 'QUALITY_ISSUE', 'UNOPENED', 'OTHER'))
);

ALTER TABLE app.transaction_approvals
    DROP CONSTRAINT IF EXISTS transaction_approvals_type_check;

ALTER TABLE app.transaction_approvals
    ADD CONSTRAINT transaction_approvals_type_check
    CHECK (transaction_type IN ('PURCHASE_ORDER', 'SALES_ORDER', 'STOCK_OPNAME', 'PURCHASE_RETURN'));

INSERT INTO app.code_number_settings (
    module_key, module_label, field_name, is_automatic, prefix,
    separator, digit_length, include_year, include_month,
    reset_rule, last_number, last_period
)
VALUES (
    'PURCHASE_RETURN', 'Retur Pembelian', 'return_number', TRUE, 'PRT',
    '-', 4, TRUE, FALSE, 'YEARLY', 0, TO_CHAR(CURRENT_DATE, 'YYYY')
)
ON CONFLICT (module_key) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_purchase_returns_date
    ON app.purchase_returns(return_date DESC);
CREATE INDEX IF NOT EXISTS idx_purchase_returns_status
    ON app.purchase_returns(status);
CREATE INDEX IF NOT EXISTS idx_purchase_returns_receipt
    ON app.purchase_returns(goods_receipt_id);
CREATE INDEX IF NOT EXISTS idx_purchase_return_items_product
    ON app.purchase_return_items(product_id);

DROP TRIGGER IF EXISTS trg_purchase_returns_updated_at ON app.purchase_returns;
CREATE TRIGGER trg_purchase_returns_updated_at
    BEFORE UPDATE ON app.purchase_returns
    FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();

COMMIT;
