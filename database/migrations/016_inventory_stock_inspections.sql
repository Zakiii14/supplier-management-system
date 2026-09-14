BEGIN;

CREATE TABLE IF NOT EXISTS app.inventory_stock_inspections (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    inspection_number VARCHAR(40) NOT NULL UNIQUE,
    product_id UUID NOT NULL REFERENCES app.products(id) ON DELETE RESTRICT,
    source_bucket VARCHAR(20) DEFAULT 'QUARANTINE' NOT NULL
        CHECK (source_bucket = 'QUARANTINE'),
    target_bucket VARCHAR(20) NOT NULL
        CHECK (target_bucket IN ('AVAILABLE', 'DAMAGED')),
    quantity NUMERIC(18,3) NOT NULL CHECK (quantity > 0),
    inspection_date DATE DEFAULT CURRENT_DATE NOT NULL,
    notes TEXT,
    created_by UUID REFERENCES app.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_inventory_stock_inspections_product
    ON app.inventory_stock_inspections(product_id, inspection_date DESC);

COMMIT;
