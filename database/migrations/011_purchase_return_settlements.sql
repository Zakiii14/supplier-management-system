BEGIN;

CREATE TABLE IF NOT EXISTS app.purchase_return_settlements (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    purchase_return_id UUID NOT NULL REFERENCES app.purchase_returns(id) ON DELETE RESTRICT,
    supplier_invoice_id UUID REFERENCES app.supplier_invoices(id) ON DELETE RESTRICT,
    settlement_type VARCHAR(30) NOT NULL,
    settlement_date DATE DEFAULT CURRENT_DATE NOT NULL,
    amount NUMERIC(18,2) NOT NULL,
    reference_number VARCHAR(100),
    notes TEXT,
    created_by UUID REFERENCES app.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    CONSTRAINT purchase_return_settlements_type_check CHECK (
        settlement_type IN ('INVOICE_DEDUCTION', 'REFUND', 'REPLACEMENT', 'SUPPLIER_CREDIT')
    ),
    CONSTRAINT purchase_return_settlements_amount_check CHECK (amount > 0),
    CONSTRAINT purchase_return_settlements_invoice_check CHECK (
        (settlement_type IN ('INVOICE_DEDUCTION', 'SUPPLIER_CREDIT') AND supplier_invoice_id IS NOT NULL)
        OR (settlement_type IN ('REFUND', 'REPLACEMENT') AND supplier_invoice_id IS NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_purchase_return_settlements_return
    ON app.purchase_return_settlements(purchase_return_id, settlement_date DESC);
CREATE INDEX IF NOT EXISTS idx_purchase_return_settlements_invoice
    ON app.purchase_return_settlements(supplier_invoice_id)
    WHERE supplier_invoice_id IS NOT NULL;

COMMIT;
