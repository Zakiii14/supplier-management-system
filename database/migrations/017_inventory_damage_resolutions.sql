BEGIN;

CREATE TABLE IF NOT EXISTS app.inventory_damage_resolutions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    resolution_number VARCHAR(40) NOT NULL UNIQUE,
    product_id UUID NOT NULL REFERENCES app.products(id) ON DELETE RESTRICT,
    resolution_action VARCHAR(30) NOT NULL
        CHECK (resolution_action IN ('REWORK_TO_QUARANTINE', 'DISPOSE')),
    quantity NUMERIC(18,3) NOT NULL CHECK (quantity > 0),
    resolution_date DATE DEFAULT CURRENT_DATE NOT NULL,
    notes TEXT,
    created_by UUID REFERENCES app.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_inventory_damage_resolutions_product
    ON app.inventory_damage_resolutions(product_id, resolution_date DESC);

COMMIT;
