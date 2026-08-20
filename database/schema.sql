--
-- PostgreSQL database dump
--

\restrict eadBpzqdf6zSNtlqVI9PXkFsY0fpK5Rkf8RMQUnoGJMsk1z8BCm8tDnlsSLGlBd

-- Dumped from database version 18.6
-- Dumped by pg_dump version 18.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: app; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA app;


--
-- Name: delivery_status; Type: TYPE; Schema: app; Owner: -
--

CREATE TYPE app.delivery_status AS ENUM (
    'PENDING',
    'SHIPPED',
    'DELIVERED',
    'CANCELLED'
);


--
-- Name: inventory_movement_type; Type: TYPE; Schema: app; Owner: -
--

CREATE TYPE app.inventory_movement_type AS ENUM (
    'PURCHASE_RECEIPT',
    'SALES_ISSUE',
    'ADJUSTMENT_IN',
    'ADJUSTMENT_OUT',
    'RETURN_IN',
    'RETURN_OUT'
);


--
-- Name: invoice_status; Type: TYPE; Schema: app; Owner: -
--

CREATE TYPE app.invoice_status AS ENUM (
    'UNPAID',
    'PARTIAL',
    'PAID',
    'OVERDUE',
    'CANCELLED'
);


--
-- Name: payment_method; Type: TYPE; Schema: app; Owner: -
--

CREATE TYPE app.payment_method AS ENUM (
    'CASH',
    'BANK_TRANSFER',
    'GIRO',
    'OTHER'
);


--
-- Name: purchase_order_status; Type: TYPE; Schema: app; Owner: -
--

CREATE TYPE app.purchase_order_status AS ENUM (
    'DRAFT',
    'SUBMITTED',
    'PARTIALLY_RECEIVED',
    'RECEIVED',
    'CANCELLED'
);


--
-- Name: record_status; Type: TYPE; Schema: app; Owner: -
--

CREATE TYPE app.record_status AS ENUM (
    'ACTIVE',
    'INACTIVE'
);


--
-- Name: sales_order_status; Type: TYPE; Schema: app; Owner: -
--

CREATE TYPE app.sales_order_status AS ENUM (
    'DRAFT',
    'CONFIRMED',
    'PARTIALLY_DELIVERED',
    'DELIVERED',
    'CANCELLED'
);


--
-- Name: user_role; Type: TYPE; Schema: app; Owner: -
--

CREATE TYPE app.user_role AS ENUM (
    'ADMIN',
    'PURCHASING',
    'WAREHOUSE',
    'SALES',
    'FINANCE',
    'MANAGER'
);


--
-- Name: set_updated_at(); Type: FUNCTION; Schema: app; Owner: -
--

CREATE FUNCTION app.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN

    NEW.updated_at = NOW();

    RETURN NEW;

END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: categories; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    category_code character varying(30) NOT NULL,
    category_name character varying(100) NOT NULL,
    status app.record_status DEFAULT 'ACTIVE'::app.record_status NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: customers; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.customers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    customer_code character varying(30) NOT NULL,
    customer_name character varying(150) NOT NULL,
    contact_person character varying(150),
    phone character varying(30),
    email character varying(150),
    address text,
    city character varying(100),
    payment_terms_days integer DEFAULT 0 NOT NULL,
    credit_limit numeric(18,2) DEFAULT 0 NOT NULL,
    status app.record_status DEFAULT 'ACTIVE'::app.record_status NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT customers_credit_limit_check CHECK ((credit_limit >= (0)::numeric)),
    CONSTRAINT customers_payment_terms_days_check CHECK ((payment_terms_days >= 0))
);


--
-- Name: deliveries; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.deliveries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    delivery_number character varying(40) NOT NULL,
    sales_order_id uuid NOT NULL,
    delivery_date date DEFAULT CURRENT_DATE NOT NULL,
    status app.delivery_status DEFAULT 'PENDING'::app.delivery_status NOT NULL,
    recipient_name character varying(150),
    address text,
    delivered_at timestamp with time zone,
    notes text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: delivery_items; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.delivery_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    delivery_id uuid NOT NULL,
    sales_order_item_id uuid NOT NULL,
    product_id uuid NOT NULL,
    quantity_delivered numeric(18,3) NOT NULL,
    CONSTRAINT delivery_items_quantity_delivered_check CHECK ((quantity_delivered > (0)::numeric))
);


--
-- Name: goods_receipt_items; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.goods_receipt_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    goods_receipt_id uuid NOT NULL,
    purchase_order_item_id uuid NOT NULL,
    product_id uuid NOT NULL,
    quantity_received numeric(18,3) NOT NULL,
    quantity_damaged numeric(18,3) DEFAULT 0 NOT NULL,
    notes text,
    CONSTRAINT goods_receipt_items_check CHECK ((quantity_damaged <= quantity_received)),
    CONSTRAINT goods_receipt_items_quantity_damaged_check CHECK ((quantity_damaged >= (0)::numeric)),
    CONSTRAINT goods_receipt_items_quantity_received_check CHECK ((quantity_received > (0)::numeric))
);


--
-- Name: goods_receipts; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.goods_receipts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    receipt_number character varying(40) NOT NULL,
    purchase_order_id uuid NOT NULL,
    received_date date DEFAULT CURRENT_DATE NOT NULL,
    received_by uuid,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: inventory_movements; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.inventory_movements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    product_id uuid NOT NULL,
    movement_type app.inventory_movement_type NOT NULL,
    quantity numeric(18,3) NOT NULL,
    reference_type character varying(50),
    reference_id uuid,
    movement_date timestamp with time zone DEFAULT now() NOT NULL,
    notes text,
    created_by uuid,
    CONSTRAINT inventory_movements_quantity_check CHECK ((quantity > (0)::numeric))
);


--
-- Name: invoices; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.invoices (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    invoice_number character varying(40) NOT NULL,
    sales_order_id uuid NOT NULL,
    customer_id uuid NOT NULL,
    invoice_date date DEFAULT CURRENT_DATE NOT NULL,
    due_date date NOT NULL,
    subtotal numeric(18,2) DEFAULT 0 NOT NULL,
    discount_amount numeric(18,2) DEFAULT 0 NOT NULL,
    tax_amount numeric(18,2) DEFAULT 0 NOT NULL,
    grand_total numeric(18,2) DEFAULT 0 NOT NULL,
    paid_amount numeric(18,2) DEFAULT 0 NOT NULL,
    status app.invoice_status DEFAULT 'UNPAID'::app.invoice_status NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT invoices_check CHECK ((paid_amount <= grand_total)),
    CONSTRAINT invoices_discount_amount_check CHECK ((discount_amount >= (0)::numeric)),
    CONSTRAINT invoices_grand_total_check CHECK ((grand_total >= (0)::numeric)),
    CONSTRAINT invoices_paid_amount_check CHECK ((paid_amount >= (0)::numeric)),
    CONSTRAINT invoices_subtotal_check CHECK ((subtotal >= (0)::numeric)),
    CONSTRAINT invoices_tax_amount_check CHECK ((tax_amount >= (0)::numeric))
);


--
-- Name: payments; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.payments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    payment_number character varying(40) NOT NULL,
    invoice_id uuid NOT NULL,
    payment_date date DEFAULT CURRENT_DATE NOT NULL,
    amount numeric(18,2) NOT NULL,
    method app.payment_method NOT NULL,
    reference_number character varying(100),
    notes text,
    received_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT payments_amount_check CHECK ((amount > (0)::numeric))
);


--
-- Name: products; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.products (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    sku character varying(50) NOT NULL,
    product_name character varying(150) NOT NULL,
    category_id uuid NOT NULL,
    supplier_id uuid NOT NULL,
    unit character varying(30) DEFAULT 'PCS'::character varying NOT NULL,
    purchase_price numeric(18,2) DEFAULT 0 NOT NULL,
    selling_price numeric(18,2) DEFAULT 0 NOT NULL,
    minimum_stock numeric(18,3) DEFAULT 0 NOT NULL,
    current_stock numeric(18,3) DEFAULT 0 NOT NULL,
    status app.record_status DEFAULT 'ACTIVE'::app.record_status NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT products_current_stock_check CHECK ((current_stock >= (0)::numeric)),
    CONSTRAINT products_minimum_stock_check CHECK ((minimum_stock >= (0)::numeric)),
    CONSTRAINT products_purchase_price_check CHECK ((purchase_price >= (0)::numeric)),
    CONSTRAINT products_selling_price_check CHECK ((selling_price >= (0)::numeric))
);


--
-- Name: purchase_order_items; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.purchase_order_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    purchase_order_id uuid NOT NULL,
    product_id uuid NOT NULL,
    quantity numeric(18,3) NOT NULL,
    unit_price numeric(18,2) NOT NULL,
    received_quantity numeric(18,3) DEFAULT 0 NOT NULL,
    CONSTRAINT purchase_order_items_check CHECK ((received_quantity <= quantity)),
    CONSTRAINT purchase_order_items_quantity_check CHECK ((quantity > (0)::numeric)),
    CONSTRAINT purchase_order_items_received_quantity_check CHECK ((received_quantity >= (0)::numeric)),
    CONSTRAINT purchase_order_items_unit_price_check CHECK ((unit_price >= (0)::numeric))
);


--
-- Name: purchase_orders; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.purchase_orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    po_number character varying(40) NOT NULL,
    supplier_id uuid NOT NULL,
    order_date date DEFAULT CURRENT_DATE NOT NULL,
    expected_date date,
    status app.purchase_order_status DEFAULT 'DRAFT'::app.purchase_order_status NOT NULL,
    notes text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT purchase_orders_check CHECK (((expected_date IS NULL) OR (expected_date >= order_date)))
);


--
-- Name: sales_order_items; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.sales_order_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    sales_order_id uuid NOT NULL,
    product_id uuid NOT NULL,
    quantity numeric(18,3) NOT NULL,
    unit_price numeric(18,2) NOT NULL,
    discount_amount numeric(18,2) DEFAULT 0 NOT NULL,
    CONSTRAINT sales_order_items_discount_amount_check CHECK ((discount_amount >= (0)::numeric)),
    CONSTRAINT sales_order_items_quantity_check CHECK ((quantity > (0)::numeric)),
    CONSTRAINT sales_order_items_unit_price_check CHECK ((unit_price >= (0)::numeric))
);


--
-- Name: sales_orders; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.sales_orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    so_number character varying(40) NOT NULL,
    customer_id uuid NOT NULL,
    order_date date DEFAULT CURRENT_DATE NOT NULL,
    requested_delivery_date date,
    status app.sales_order_status DEFAULT 'DRAFT'::app.sales_order_status NOT NULL,
    notes text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT sales_orders_check CHECK (((requested_delivery_date IS NULL) OR (requested_delivery_date >= order_date)))
);


--
-- Name: suppliers; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.suppliers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    supplier_code character varying(30) NOT NULL,
    supplier_name character varying(150) NOT NULL,
    contact_person character varying(150),
    phone character varying(30),
    email character varying(150),
    address text,
    city character varying(100),
    payment_terms_days integer DEFAULT 0 NOT NULL,
    status app.record_status DEFAULT 'ACTIVE'::app.record_status NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT suppliers_payment_terms_days_check CHECK ((payment_terms_days >= 0))
);


--
-- Name: users; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    username character varying(50) NOT NULL,
    full_name character varying(150) NOT NULL,
    email character varying(150),
    password_hash text,
    role app.user_role DEFAULT 'ADMIN'::app.user_role NOT NULL,
    status app.record_status DEFAULT 'ACTIVE'::app.record_status NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: v_low_stock_products; Type: VIEW; Schema: app; Owner: -
--

CREATE VIEW app.v_low_stock_products AS
 SELECT p.id,
    p.sku,
    p.product_name,
    c.category_name,
    s.supplier_name,
    p.current_stock,
    p.minimum_stock,
    p.unit
   FROM ((app.products p
     JOIN app.categories c ON ((c.id = p.category_id)))
     JOIN app.suppliers s ON ((s.id = p.supplier_id)))
  WHERE ((p.status = 'ACTIVE'::app.record_status) AND (p.current_stock <= p.minimum_stock));


--
-- Name: v_outstanding_invoices; Type: VIEW; Schema: app; Owner: -
--

CREATE VIEW app.v_outstanding_invoices AS
 SELECT i.id,
    i.invoice_number,
    i.customer_id,
    c.customer_name,
    i.invoice_date,
    i.due_date,
    i.grand_total,
    i.paid_amount,
    (i.grand_total - i.paid_amount) AS outstanding_amount,
        CASE
            WHEN (i.paid_amount >= i.grand_total) THEN 'PAID'::text
            WHEN (CURRENT_DATE > i.due_date) THEN 'OVERDUE'::text
            WHEN (i.paid_amount > (0)::numeric) THEN 'PARTIAL'::text
            ELSE 'UNPAID'::text
        END AS calculated_status
   FROM (app.invoices i
     JOIN app.customers c ON ((c.id = i.customer_id)))
  WHERE ((i.status <> 'CANCELLED'::app.invoice_status) AND (i.paid_amount < i.grand_total));


--
-- Name: v_purchase_order_summary; Type: VIEW; Schema: app; Owner: -
--

CREATE VIEW app.v_purchase_order_summary AS
 SELECT po.id,
    po.po_number,
    s.supplier_name,
    po.order_date,
    po.expected_date,
    po.status,
    COALESCE(sum((poi.quantity * poi.unit_price)), (0)::numeric) AS total_amount,
    COALESCE(sum(poi.quantity), (0)::numeric) AS total_ordered_quantity,
    COALESCE(sum(poi.received_quantity), (0)::numeric) AS total_received_quantity
   FROM ((app.purchase_orders po
     JOIN app.suppliers s ON ((s.id = po.supplier_id)))
     LEFT JOIN app.purchase_order_items poi ON ((poi.purchase_order_id = po.id)))
  GROUP BY po.id, po.po_number, s.supplier_name, po.order_date, po.expected_date, po.status;


--
-- Name: categories categories_category_code_key; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.categories
    ADD CONSTRAINT categories_category_code_key UNIQUE (category_code);


--
-- Name: categories categories_category_name_key; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.categories
    ADD CONSTRAINT categories_category_name_key UNIQUE (category_name);


--
-- Name: categories categories_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.categories
    ADD CONSTRAINT categories_pkey PRIMARY KEY (id);


--
-- Name: customers customers_customer_code_key; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.customers
    ADD CONSTRAINT customers_customer_code_key UNIQUE (customer_code);


--
-- Name: customers customers_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.customers
    ADD CONSTRAINT customers_pkey PRIMARY KEY (id);


--
-- Name: deliveries deliveries_delivery_number_key; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.deliveries
    ADD CONSTRAINT deliveries_delivery_number_key UNIQUE (delivery_number);


--
-- Name: deliveries deliveries_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.deliveries
    ADD CONSTRAINT deliveries_pkey PRIMARY KEY (id);


--
-- Name: delivery_items delivery_items_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.delivery_items
    ADD CONSTRAINT delivery_items_pkey PRIMARY KEY (id);


--
-- Name: goods_receipt_items goods_receipt_items_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.goods_receipt_items
    ADD CONSTRAINT goods_receipt_items_pkey PRIMARY KEY (id);


--
-- Name: goods_receipts goods_receipts_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.goods_receipts
    ADD CONSTRAINT goods_receipts_pkey PRIMARY KEY (id);


--
-- Name: goods_receipts goods_receipts_receipt_number_key; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.goods_receipts
    ADD CONSTRAINT goods_receipts_receipt_number_key UNIQUE (receipt_number);


--
-- Name: inventory_movements inventory_movements_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.inventory_movements
    ADD CONSTRAINT inventory_movements_pkey PRIMARY KEY (id);


--
-- Name: invoices invoices_invoice_number_key; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.invoices
    ADD CONSTRAINT invoices_invoice_number_key UNIQUE (invoice_number);


--
-- Name: invoices invoices_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.invoices
    ADD CONSTRAINT invoices_pkey PRIMARY KEY (id);


--
-- Name: invoices invoices_sales_order_id_key; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.invoices
    ADD CONSTRAINT invoices_sales_order_id_key UNIQUE (sales_order_id);


--
-- Name: payments payments_payment_number_key; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.payments
    ADD CONSTRAINT payments_payment_number_key UNIQUE (payment_number);


--
-- Name: payments payments_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.payments
    ADD CONSTRAINT payments_pkey PRIMARY KEY (id);


--
-- Name: products products_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);


--
-- Name: products products_sku_key; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.products
    ADD CONSTRAINT products_sku_key UNIQUE (sku);


--
-- Name: purchase_order_items purchase_order_items_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.purchase_order_items
    ADD CONSTRAINT purchase_order_items_pkey PRIMARY KEY (id);


--
-- Name: purchase_order_items purchase_order_items_purchase_order_id_product_id_key; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.purchase_order_items
    ADD CONSTRAINT purchase_order_items_purchase_order_id_product_id_key UNIQUE (purchase_order_id, product_id);


--
-- Name: purchase_orders purchase_orders_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.purchase_orders
    ADD CONSTRAINT purchase_orders_pkey PRIMARY KEY (id);


--
-- Name: purchase_orders purchase_orders_po_number_key; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.purchase_orders
    ADD CONSTRAINT purchase_orders_po_number_key UNIQUE (po_number);


--
-- Name: sales_order_items sales_order_items_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.sales_order_items
    ADD CONSTRAINT sales_order_items_pkey PRIMARY KEY (id);


--
-- Name: sales_order_items sales_order_items_sales_order_id_product_id_key; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.sales_order_items
    ADD CONSTRAINT sales_order_items_sales_order_id_product_id_key UNIQUE (sales_order_id, product_id);


--
-- Name: sales_orders sales_orders_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.sales_orders
    ADD CONSTRAINT sales_orders_pkey PRIMARY KEY (id);


--
-- Name: sales_orders sales_orders_so_number_key; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.sales_orders
    ADD CONSTRAINT sales_orders_so_number_key UNIQUE (so_number);


--
-- Name: suppliers suppliers_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.suppliers
    ADD CONSTRAINT suppliers_pkey PRIMARY KEY (id);


--
-- Name: suppliers suppliers_supplier_code_key; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.suppliers
    ADD CONSTRAINT suppliers_supplier_code_key UNIQUE (supplier_code);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users users_username_key; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.users
    ADD CONSTRAINT users_username_key UNIQUE (username);


--
-- Name: idx_delivery_so; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX idx_delivery_so ON app.deliveries USING btree (sales_order_id);


--
-- Name: idx_inventory_product_date; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX idx_inventory_product_date ON app.inventory_movements USING btree (product_id, movement_date);


--
-- Name: idx_inventory_reference; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX idx_inventory_reference ON app.inventory_movements USING btree (reference_type, reference_id);


--
-- Name: idx_invoice_customer; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX idx_invoice_customer ON app.invoices USING btree (customer_id);


--
-- Name: idx_invoice_status_due; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX idx_invoice_status_due ON app.invoices USING btree (status, due_date);


--
-- Name: idx_payment_invoice; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX idx_payment_invoice ON app.payments USING btree (invoice_id);


--
-- Name: idx_po_items_product; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX idx_po_items_product ON app.purchase_order_items USING btree (product_id);


--
-- Name: idx_po_status; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX idx_po_status ON app.purchase_orders USING btree (status);


--
-- Name: idx_po_supplier; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX idx_po_supplier ON app.purchase_orders USING btree (supplier_id);


--
-- Name: idx_products_category; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX idx_products_category ON app.products USING btree (category_id);


--
-- Name: idx_products_low_stock; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX idx_products_low_stock ON app.products USING btree (current_stock, minimum_stock);


--
-- Name: idx_products_supplier; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX idx_products_supplier ON app.products USING btree (supplier_id);


--
-- Name: idx_receipt_items_product; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX idx_receipt_items_product ON app.goods_receipt_items USING btree (product_id);


--
-- Name: idx_receipts_po; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX idx_receipts_po ON app.goods_receipts USING btree (purchase_order_id);


--
-- Name: idx_so_customer; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX idx_so_customer ON app.sales_orders USING btree (customer_id);


--
-- Name: idx_so_items_product; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX idx_so_items_product ON app.sales_order_items USING btree (product_id);


--
-- Name: idx_so_status; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX idx_so_status ON app.sales_orders USING btree (status);


--
-- Name: invoices trg_invoices_updated_at; Type: TRIGGER; Schema: app; Owner: -
--

CREATE TRIGGER trg_invoices_updated_at BEFORE UPDATE ON app.invoices FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();


--
-- Name: products trg_products_updated_at; Type: TRIGGER; Schema: app; Owner: -
--

CREATE TRIGGER trg_products_updated_at BEFORE UPDATE ON app.products FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();


--
-- Name: purchase_orders trg_purchase_orders_updated_at; Type: TRIGGER; Schema: app; Owner: -
--

CREATE TRIGGER trg_purchase_orders_updated_at BEFORE UPDATE ON app.purchase_orders FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();


--
-- Name: sales_orders trg_sales_orders_updated_at; Type: TRIGGER; Schema: app; Owner: -
--

CREATE TRIGGER trg_sales_orders_updated_at BEFORE UPDATE ON app.sales_orders FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();


--
-- Name: suppliers trg_suppliers_updated_at; Type: TRIGGER; Schema: app; Owner: -
--

CREATE TRIGGER trg_suppliers_updated_at BEFORE UPDATE ON app.suppliers FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();


--
-- Name: users trg_users_updated_at; Type: TRIGGER; Schema: app; Owner: -
--

CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON app.users FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();


--
-- Name: deliveries deliveries_created_by_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.deliveries
    ADD CONSTRAINT deliveries_created_by_fkey FOREIGN KEY (created_by) REFERENCES app.users(id) ON DELETE SET NULL;


--
-- Name: deliveries deliveries_sales_order_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.deliveries
    ADD CONSTRAINT deliveries_sales_order_id_fkey FOREIGN KEY (sales_order_id) REFERENCES app.sales_orders(id);


--
-- Name: delivery_items delivery_items_delivery_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.delivery_items
    ADD CONSTRAINT delivery_items_delivery_id_fkey FOREIGN KEY (delivery_id) REFERENCES app.deliveries(id) ON DELETE CASCADE;


--
-- Name: delivery_items delivery_items_product_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.delivery_items
    ADD CONSTRAINT delivery_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES app.products(id);


--
-- Name: delivery_items delivery_items_sales_order_item_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.delivery_items
    ADD CONSTRAINT delivery_items_sales_order_item_id_fkey FOREIGN KEY (sales_order_item_id) REFERENCES app.sales_order_items(id);


--
-- Name: goods_receipt_items goods_receipt_items_goods_receipt_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.goods_receipt_items
    ADD CONSTRAINT goods_receipt_items_goods_receipt_id_fkey FOREIGN KEY (goods_receipt_id) REFERENCES app.goods_receipts(id) ON DELETE CASCADE;


--
-- Name: goods_receipt_items goods_receipt_items_product_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.goods_receipt_items
    ADD CONSTRAINT goods_receipt_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES app.products(id);


--
-- Name: goods_receipt_items goods_receipt_items_purchase_order_item_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.goods_receipt_items
    ADD CONSTRAINT goods_receipt_items_purchase_order_item_id_fkey FOREIGN KEY (purchase_order_item_id) REFERENCES app.purchase_order_items(id);


--
-- Name: goods_receipts goods_receipts_purchase_order_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.goods_receipts
    ADD CONSTRAINT goods_receipts_purchase_order_id_fkey FOREIGN KEY (purchase_order_id) REFERENCES app.purchase_orders(id);


--
-- Name: goods_receipts goods_receipts_received_by_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.goods_receipts
    ADD CONSTRAINT goods_receipts_received_by_fkey FOREIGN KEY (received_by) REFERENCES app.users(id) ON DELETE SET NULL;


--
-- Name: inventory_movements inventory_movements_created_by_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.inventory_movements
    ADD CONSTRAINT inventory_movements_created_by_fkey FOREIGN KEY (created_by) REFERENCES app.users(id) ON DELETE SET NULL;


--
-- Name: inventory_movements inventory_movements_product_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.inventory_movements
    ADD CONSTRAINT inventory_movements_product_id_fkey FOREIGN KEY (product_id) REFERENCES app.products(id);


--
-- Name: invoices invoices_customer_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.invoices
    ADD CONSTRAINT invoices_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES app.customers(id);


--
-- Name: invoices invoices_sales_order_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.invoices
    ADD CONSTRAINT invoices_sales_order_id_fkey FOREIGN KEY (sales_order_id) REFERENCES app.sales_orders(id);


--
-- Name: payments payments_invoice_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.payments
    ADD CONSTRAINT payments_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES app.invoices(id);


--
-- Name: payments payments_received_by_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.payments
    ADD CONSTRAINT payments_received_by_fkey FOREIGN KEY (received_by) REFERENCES app.users(id) ON DELETE SET NULL;


--
-- Name: products products_category_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.products
    ADD CONSTRAINT products_category_id_fkey FOREIGN KEY (category_id) REFERENCES app.categories(id);


--
-- Name: products products_supplier_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.products
    ADD CONSTRAINT products_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES app.suppliers(id);


--
-- Name: purchase_order_items purchase_order_items_product_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.purchase_order_items
    ADD CONSTRAINT purchase_order_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES app.products(id);


--
-- Name: purchase_order_items purchase_order_items_purchase_order_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.purchase_order_items
    ADD CONSTRAINT purchase_order_items_purchase_order_id_fkey FOREIGN KEY (purchase_order_id) REFERENCES app.purchase_orders(id) ON DELETE CASCADE;


--
-- Name: purchase_orders purchase_orders_created_by_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.purchase_orders
    ADD CONSTRAINT purchase_orders_created_by_fkey FOREIGN KEY (created_by) REFERENCES app.users(id) ON DELETE SET NULL;


--
-- Name: purchase_orders purchase_orders_supplier_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.purchase_orders
    ADD CONSTRAINT purchase_orders_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES app.suppliers(id);


--
-- Name: sales_order_items sales_order_items_product_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.sales_order_items
    ADD CONSTRAINT sales_order_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES app.products(id);


--
-- Name: sales_order_items sales_order_items_sales_order_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.sales_order_items
    ADD CONSTRAINT sales_order_items_sales_order_id_fkey FOREIGN KEY (sales_order_id) REFERENCES app.sales_orders(id) ON DELETE CASCADE;


--
-- Name: sales_orders sales_orders_created_by_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.sales_orders
    ADD CONSTRAINT sales_orders_created_by_fkey FOREIGN KEY (created_by) REFERENCES app.users(id) ON DELETE SET NULL;


--
-- Name: sales_orders sales_orders_customer_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.sales_orders
    ADD CONSTRAINT sales_orders_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES app.customers(id);


--
-- PostgreSQL database dump complete
--

\unrestrict eadBpzqdf6zSNtlqVI9PXkFsY0fpK5Rkf8RMQUnoGJMsk1z8BCm8tDnlsSLGlBd

