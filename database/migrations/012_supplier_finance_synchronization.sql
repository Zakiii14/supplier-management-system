BEGIN;

-- Tautkan pembayaran lama ketika PO hanya memiliki satu invoice supplier.
WITH unique_invoice AS (
    SELECT purchase_order_id, MIN(id::text)::uuid AS supplier_invoice_id
    FROM app.supplier_invoices
    GROUP BY purchase_order_id
    HAVING COUNT(*) = 1
)
UPDATE app.supplier_payments sp
SET supplier_invoice_id = ui.supplier_invoice_id,
    supplier_invoice_number = si.invoice_number
FROM unique_invoice ui
JOIN app.supplier_invoices si ON si.id = ui.supplier_invoice_id
WHERE sp.purchase_order_id = ui.purchase_order_id
  AND sp.supplier_invoice_id IS NULL;

-- Rapikan nomor invoice tersalin pada pembayaran yang sudah memiliki relasi.
UPDATE app.supplier_payments sp
SET supplier_invoice_number = si.invoice_number
FROM app.supplier_invoices si
WHERE sp.supplier_invoice_id = si.id
  AND sp.supplier_invoice_number IS DISTINCT FROM si.invoice_number;

CREATE OR REPLACE FUNCTION app.enforce_single_supplier_invoice_per_po()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    po_total numeric(18,2);
BEGIN
    SELECT COALESCE(SUM(quantity * unit_price), 0)::numeric(18,2)
    INTO po_total
    FROM app.purchase_order_items
    WHERE purchase_order_id = NEW.purchase_order_id;

    IF NEW.total_amount <> po_total THEN
        RAISE EXCEPTION 'Total tagihan supplier harus sama dengan total purchase order (%)', po_total
            USING ERRCODE = '23514',
                  CONSTRAINT = 'supplier_invoices_total_matches_po';
    END IF;

    IF TG_OP = 'INSERT'
       OR NEW.purchase_order_id IS DISTINCT FROM OLD.purchase_order_id THEN
        IF EXISTS (
            SELECT 1
            FROM app.supplier_invoices si
            WHERE si.purchase_order_id = NEW.purchase_order_id
              AND si.id <> NEW.id
        ) THEN
            RAISE EXCEPTION 'Purchase order sudah memiliki tagihan supplier'
                USING ERRCODE = '23505',
                      CONSTRAINT = 'supplier_invoices_purchase_order_unique';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_supplier_invoices_finance_rules
ON app.supplier_invoices;
CREATE TRIGGER trg_supplier_invoices_finance_rules
BEFORE INSERT OR UPDATE OF purchase_order_id, total_amount
ON app.supplier_invoices
FOR EACH ROW EXECUTE FUNCTION app.enforce_single_supplier_invoice_per_po();

CREATE OR REPLACE FUNCTION app.enforce_supplier_payment_invoice_link()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    invoice_po_id uuid;
    invoice_number_value varchar(100);
BEGIN
    IF NEW.supplier_invoice_id IS NULL THEN
        RAISE EXCEPTION 'Pembayaran supplier harus terhubung ke tagihan supplier'
            USING ERRCODE = '23502',
                  COLUMN = 'supplier_invoice_id';
    END IF;

    SELECT purchase_order_id, invoice_number
    INTO invoice_po_id, invoice_number_value
    FROM app.supplier_invoices
    WHERE id = NEW.supplier_invoice_id;

    IF invoice_po_id IS NULL THEN
        RAISE EXCEPTION 'Tagihan supplier tidak ditemukan'
            USING ERRCODE = '23503',
                  CONSTRAINT = 'supplier_payments_supplier_invoice_id_fkey';
    END IF;

    IF invoice_po_id <> NEW.purchase_order_id THEN
        RAISE EXCEPTION 'Tagihan supplier tidak berasal dari purchase order yang dipilih'
            USING ERRCODE = '23514',
                  CONSTRAINT = 'supplier_payments_invoice_po_match';
    END IF;

    NEW.supplier_invoice_number := invoice_number_value;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_supplier_payments_invoice_link
ON app.supplier_payments;
CREATE TRIGGER trg_supplier_payments_invoice_link
BEFORE INSERT OR UPDATE OF purchase_order_id, supplier_invoice_id, supplier_invoice_number
ON app.supplier_payments
FOR EACH ROW EXECUTE FUNCTION app.enforce_supplier_payment_invoice_link();

-- Database baru dapat memakai indeks unik. Pada database lama yang sudah telanjur
-- memiliki duplikasi, trigger di atas tetap mencegah duplikasi baru tanpa menghapus data.
DO $migration$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM app.supplier_invoices
        GROUP BY purchase_order_id
        HAVING COUNT(*) > 1
    ) THEN
        CREATE UNIQUE INDEX IF NOT EXISTS supplier_invoices_purchase_order_unique
            ON app.supplier_invoices(purchase_order_id);
    ELSE
        RAISE NOTICE 'Indeks unik PO tidak dibuat karena terdapat tagihan ganda lama; duplikasi baru tetap dicegah oleh trigger.';
    END IF;
END
$migration$;

COMMIT;
