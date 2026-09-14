BEGIN;

ALTER TABLE app.products
    ADD COLUMN IF NOT EXISTS quarantine_stock NUMERIC(18,3) DEFAULT 0 NOT NULL,
    ADD COLUMN IF NOT EXISTS damaged_stock NUMERIC(18,3) DEFAULT 0 NOT NULL;

ALTER TABLE app.products
    DROP CONSTRAINT IF EXISTS products_quarantine_stock_check;
ALTER TABLE app.products
    ADD CONSTRAINT products_quarantine_stock_check
    CHECK (quarantine_stock >= 0);

ALTER TABLE app.products
    DROP CONSTRAINT IF EXISTS products_damaged_stock_check;
ALTER TABLE app.products
    ADD CONSTRAINT products_damaged_stock_check
    CHECK (damaged_stock >= 0);

ALTER TABLE app.inventory_movements
    ADD COLUMN IF NOT EXISTS stock_bucket VARCHAR(20) DEFAULT 'AVAILABLE' NOT NULL;

ALTER TABLE app.inventory_movements
    DROP CONSTRAINT IF EXISTS inventory_movements_stock_bucket_check;
ALTER TABLE app.inventory_movements
    ADD CONSTRAINT inventory_movements_stock_bucket_check
    CHECK (stock_bucket IN ('AVAILABLE', 'QUARANTINE', 'DAMAGED'));

WITH missing_returns AS (
    SELECT sri.product_id,sri.quantity,sri.item_condition
    FROM app.sales_return_items sri
    JOIN app.sales_returns sr ON sr.id = sri.sales_return_id
    WHERE sr.status = 'APPROVED'
      AND sri.item_condition IN ('QUARANTINE', 'DAMAGED')
      AND NOT EXISTS (
          SELECT 1
          FROM app.inventory_movements im
          WHERE im.reference_type = 'SALES_RETURN'
            AND im.reference_id = sr.id
            AND im.product_id = sri.product_id
      )
), bucket_totals AS (
    SELECT product_id,
           COALESCE(SUM(quantity) FILTER (WHERE item_condition = 'QUARANTINE'),0) AS quarantine_quantity,
           COALESCE(SUM(quantity) FILTER (WHERE item_condition = 'DAMAGED'),0) AS damaged_quantity
    FROM missing_returns
    GROUP BY product_id
)
UPDATE app.products p
SET quarantine_stock = p.quarantine_stock + totals.quarantine_quantity,
    damaged_stock = p.damaged_stock + totals.damaged_quantity,
    updated_at = NOW()
FROM bucket_totals totals
WHERE totals.product_id = p.id;

INSERT INTO app.inventory_movements(
    product_id,movement_type,quantity,reference_type,reference_id,
    stock_bucket,notes,created_by
)
SELECT sri.product_id,'RETURN_IN',sri.quantity,'SALES_RETURN',sr.id,
       sri.item_condition,
       'Retur penjualan ' || sr.return_number,
       sr.decided_by
FROM app.sales_return_items sri
JOIN app.sales_returns sr ON sr.id = sri.sales_return_id
WHERE sr.status = 'APPROVED'
  AND sri.item_condition IN ('QUARANTINE', 'DAMAGED')
  AND NOT EXISTS (
      SELECT 1
      FROM app.inventory_movements im
      WHERE im.reference_type = 'SALES_RETURN'
        AND im.reference_id = sr.id
        AND im.product_id = sri.product_id
  );

COMMIT;
