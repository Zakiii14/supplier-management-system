BEGIN;

ALTER TABLE app.invoices
    ADD COLUMN IF NOT EXISTS credit_amount NUMERIC(18,2) DEFAULT 0 NOT NULL;

ALTER TABLE app.invoices
    DROP CONSTRAINT IF EXISTS invoices_credit_amount_check;
ALTER TABLE app.invoices
    ADD CONSTRAINT invoices_credit_amount_check
    CHECK (credit_amount >= 0 AND credit_amount <= grand_total);
ALTER TABLE app.invoices
    DROP CONSTRAINT IF EXISTS invoices_settlement_amount_check;
ALTER TABLE app.invoices
    ADD CONSTRAINT invoices_settlement_amount_check
    CHECK (paid_amount + credit_amount <= grand_total);

CREATE OR REPLACE VIEW app.v_outstanding_invoices AS
 SELECT i.id,i.invoice_number,i.customer_id,c.customer_name,i.invoice_date,i.due_date,
        i.grand_total,i.paid_amount,
        (i.grand_total-i.paid_amount-i.credit_amount) AS outstanding_amount,
        CASE
          WHEN i.paid_amount+i.credit_amount>=i.grand_total THEN 'PAID'::text
          WHEN CURRENT_DATE>i.due_date THEN 'OVERDUE'::text
          WHEN i.paid_amount+i.credit_amount>0 THEN 'PARTIAL'::text
          ELSE 'UNPAID'::text
        END AS calculated_status
 FROM app.invoices i JOIN app.customers c ON c.id=i.customer_id
 WHERE i.status<>'CANCELLED'::app.invoice_status
   AND i.paid_amount+i.credit_amount<i.grand_total;

CREATE TABLE IF NOT EXISTS app.sales_returns (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    return_number VARCHAR(40) NOT NULL UNIQUE,
    delivery_id UUID NOT NULL REFERENCES app.deliveries(id) ON DELETE RESTRICT,
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
    CONSTRAINT sales_returns_status_check
        CHECK (status IN ('DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'CANCELLED')),
    CONSTRAINT sales_returns_reason_check
        CHECK (reason IN ('DAMAGED', 'WRONG_ITEM', 'QUALITY_ISSUE', 'CUSTOMER_REQUEST', 'OTHER'))
);

CREATE TABLE IF NOT EXISTS app.sales_return_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    sales_return_id UUID NOT NULL REFERENCES app.sales_returns(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES app.products(id) ON DELETE RESTRICT,
    quantity NUMERIC(18,3) NOT NULL,
    unit_price NUMERIC(18,2) NOT NULL,
    item_condition VARCHAR(20) DEFAULT 'SALEABLE' NOT NULL,
    notes VARCHAR(300),
    CONSTRAINT sales_return_items_product_unique UNIQUE (sales_return_id, product_id),
    CONSTRAINT sales_return_items_quantity_check CHECK (quantity > 0),
    CONSTRAINT sales_return_items_unit_price_check CHECK (unit_price >= 0),
    CONSTRAINT sales_return_items_condition_check
        CHECK (item_condition IN ('SALEABLE', 'DAMAGED', 'QUARANTINE'))
);

CREATE TABLE IF NOT EXISTS app.sales_return_settlements (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    sales_return_id UUID NOT NULL REFERENCES app.sales_returns(id) ON DELETE RESTRICT,
    invoice_id UUID REFERENCES app.invoices(id) ON DELETE RESTRICT,
    settlement_type VARCHAR(30) NOT NULL,
    settlement_date DATE DEFAULT CURRENT_DATE NOT NULL,
    amount NUMERIC(18,2) NOT NULL,
    reference_number VARCHAR(100),
    notes TEXT,
    created_by UUID REFERENCES app.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    CONSTRAINT sales_return_settlements_type_check CHECK (
        settlement_type IN ('INVOICE_DEDUCTION', 'REFUND', 'REPLACEMENT', 'CUSTOMER_CREDIT')
    ),
    CONSTRAINT sales_return_settlements_amount_check CHECK (amount > 0),
    CONSTRAINT sales_return_settlements_invoice_check CHECK (
        (settlement_type IN ('INVOICE_DEDUCTION', 'CUSTOMER_CREDIT') AND invoice_id IS NOT NULL)
        OR (settlement_type IN ('REFUND', 'REPLACEMENT') AND invoice_id IS NULL)
    )
);

ALTER TABLE app.transaction_approvals
    DROP CONSTRAINT IF EXISTS transaction_approvals_type_check;

ALTER TABLE app.transaction_approvals
    ADD CONSTRAINT transaction_approvals_type_check
    CHECK (transaction_type IN ('PURCHASE_ORDER', 'SALES_ORDER', 'STOCK_OPNAME', 'PURCHASE_RETURN', 'SALES_RETURN'));

INSERT INTO app.code_number_settings (
    module_key, module_label, field_name, is_automatic, prefix,
    separator, digit_length, include_year, include_month,
    reset_rule, last_number, last_period
)
VALUES (
    'SALES_RETURN', 'Retur Penjualan', 'return_number', TRUE, 'SRT',
    '-', 4, TRUE, FALSE, 'YEARLY', 0, TO_CHAR(CURRENT_DATE, 'YYYY')
)
ON CONFLICT (module_key) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_sales_returns_date ON app.sales_returns(return_date DESC);
CREATE INDEX IF NOT EXISTS idx_sales_returns_status ON app.sales_returns(status);
CREATE INDEX IF NOT EXISTS idx_sales_returns_delivery ON app.sales_returns(delivery_id);
CREATE INDEX IF NOT EXISTS idx_sales_return_items_product ON app.sales_return_items(product_id);
CREATE INDEX IF NOT EXISTS idx_sales_return_settlements_return
    ON app.sales_return_settlements(sales_return_id, settlement_date DESC);
CREATE INDEX IF NOT EXISTS idx_sales_return_settlements_invoice
    ON app.sales_return_settlements(invoice_id) WHERE invoice_id IS NOT NULL;

DROP TRIGGER IF EXISTS trg_sales_returns_updated_at ON app.sales_returns;
CREATE TRIGGER trg_sales_returns_updated_at
    BEFORE UPDATE ON app.sales_returns
    FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();

COMMIT;
