BEGIN;

CREATE TABLE IF NOT EXISTS app.supplier_invoices (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    invoice_number varchar(100) NOT NULL,
    purchase_order_id uuid NOT NULL REFERENCES app.purchase_orders(id) ON DELETE RESTRICT,
    invoice_date date NOT NULL DEFAULT CURRENT_DATE,
    due_date date NOT NULL,
    total_amount numeric(18,2) NOT NULL,
    notes text,
    created_by uuid REFERENCES app.users(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT supplier_invoices_total_check CHECK (total_amount > 0),
    CONSTRAINT supplier_invoices_due_date_check CHECK (due_date >= invoice_date),
    CONSTRAINT supplier_invoices_number_supplier_unique UNIQUE (purchase_order_id, invoice_number)
);

CREATE TABLE IF NOT EXISTS app.supplier_invoice_attachments (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    supplier_invoice_id uuid NOT NULL REFERENCES app.supplier_invoices(id) ON DELETE CASCADE,
    original_name varchar(255) NOT NULL,
    storage_name varchar(120) NOT NULL UNIQUE,
    mime_type varchar(100) NOT NULL,
    size_bytes bigint NOT NULL CHECK (size_bytes > 0),
    uploaded_by uuid REFERENCES app.users(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE app.supplier_payments
    ADD COLUMN IF NOT EXISTS supplier_invoice_id uuid;

DO $migration$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'app.supplier_payments'::regclass
          AND conname = 'supplier_payments_supplier_invoice_id_fkey'
    ) THEN
        ALTER TABLE app.supplier_payments
            ADD CONSTRAINT supplier_payments_supplier_invoice_id_fkey
            FOREIGN KEY (supplier_invoice_id)
            REFERENCES app.supplier_invoices(id) ON DELETE RESTRICT;
    END IF;
END
$migration$;

CREATE INDEX IF NOT EXISTS idx_supplier_invoices_po
    ON app.supplier_invoices(purchase_order_id, invoice_date DESC);
CREATE INDEX IF NOT EXISTS idx_supplier_invoices_due_date
    ON app.supplier_invoices(due_date);
CREATE INDEX IF NOT EXISTS idx_supplier_payments_invoice
    ON app.supplier_payments(supplier_invoice_id)
    WHERE supplier_invoice_id IS NOT NULL;

DROP TRIGGER IF EXISTS trg_supplier_invoices_updated_at ON app.supplier_invoices;
CREATE TRIGGER trg_supplier_invoices_updated_at
BEFORE UPDATE ON app.supplier_invoices
FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();

COMMIT;
