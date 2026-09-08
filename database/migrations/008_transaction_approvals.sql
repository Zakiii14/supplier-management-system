BEGIN;

ALTER TABLE app.purchase_orders
    ADD COLUMN IF NOT EXISTS approval_status VARCHAR(20),
    ADD COLUMN IF NOT EXISTS submitted_by UUID,
    ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS decided_by UUID,
    ADD COLUMN IF NOT EXISTS decided_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

ALTER TABLE app.sales_orders
    ADD COLUMN IF NOT EXISTS approval_status VARCHAR(20),
    ADD COLUMN IF NOT EXISTS submitted_by UUID,
    ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS decided_by UUID,
    ADD COLUMN IF NOT EXISTS decided_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

UPDATE app.purchase_orders
SET approval_status = CASE
    WHEN status = 'DRAFT' THEN 'DRAFT'
    WHEN status = 'CANCELLED' THEN 'CANCELLED'
    ELSE 'APPROVED'
END
WHERE approval_status IS NULL;

UPDATE app.sales_orders
SET approval_status = CASE
    WHEN status = 'DRAFT' THEN 'DRAFT'
    WHEN status = 'CANCELLED' THEN 'CANCELLED'
    ELSE 'APPROVED'
END
WHERE approval_status IS NULL;

ALTER TABLE app.purchase_orders
    ALTER COLUMN approval_status SET DEFAULT 'DRAFT',
    ALTER COLUMN approval_status SET NOT NULL;

ALTER TABLE app.sales_orders
    ALTER COLUMN approval_status SET DEFAULT 'DRAFT',
    ALTER COLUMN approval_status SET NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'purchase_orders_approval_status_check'
          AND conrelid = 'app.purchase_orders'::regclass
    ) THEN
        ALTER TABLE app.purchase_orders
            ADD CONSTRAINT purchase_orders_approval_status_check
            CHECK (approval_status IN ('DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'sales_orders_approval_status_check'
          AND conrelid = 'app.sales_orders'::regclass
    ) THEN
        ALTER TABLE app.sales_orders
            ADD CONSTRAINT sales_orders_approval_status_check
            CHECK (approval_status IN ('DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'purchase_orders_submitted_by_fkey') THEN
        ALTER TABLE app.purchase_orders ADD CONSTRAINT purchase_orders_submitted_by_fkey
            FOREIGN KEY (submitted_by) REFERENCES app.users(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'purchase_orders_decided_by_fkey') THEN
        ALTER TABLE app.purchase_orders ADD CONSTRAINT purchase_orders_decided_by_fkey
            FOREIGN KEY (decided_by) REFERENCES app.users(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sales_orders_submitted_by_fkey') THEN
        ALTER TABLE app.sales_orders ADD CONSTRAINT sales_orders_submitted_by_fkey
            FOREIGN KEY (submitted_by) REFERENCES app.users(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sales_orders_decided_by_fkey') THEN
        ALTER TABLE app.sales_orders ADD CONSTRAINT sales_orders_decided_by_fkey
            FOREIGN KEY (decided_by) REFERENCES app.users(id) ON DELETE SET NULL;
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS app.transaction_approvals (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    transaction_type VARCHAR(30) NOT NULL,
    transaction_id UUID NOT NULL,
    action VARCHAR(20) NOT NULL,
    reason TEXT,
    acted_by UUID REFERENCES app.users(id) ON DELETE SET NULL,
    acted_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    CONSTRAINT transaction_approvals_type_check
        CHECK (transaction_type IN ('PURCHASE_ORDER', 'SALES_ORDER')),
    CONSTRAINT transaction_approvals_action_check
        CHECK (action IN ('SUBMITTED', 'RESUBMITTED', 'APPROVED', 'REJECTED'))
);

CREATE INDEX IF NOT EXISTS idx_transaction_approvals_transaction
    ON app.transaction_approvals(transaction_type, transaction_id, acted_at DESC);

CREATE INDEX IF NOT EXISTS idx_purchase_orders_approval_status
    ON app.purchase_orders(approval_status);

CREATE INDEX IF NOT EXISTS idx_sales_orders_approval_status
    ON app.sales_orders(approval_status);

COMMIT;
