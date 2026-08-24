-- ==========================================
-- NEXUS CRM (StokResto) - Supabase SQL Schema
-- ==========================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Table: products
CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(200) NOT NULL,
    category VARCHAR(50) NOT NULL,
    unit VARCHAR(20) NOT NULL,
    price INTEGER NOT NULL DEFAULT 0,
    current_stock INTEGER NOT NULL DEFAULT 0,
    min_stock INTEGER NOT NULL DEFAULT 0,
    barcode VARCHAR(20) UNIQUE,
    image_url TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Table: users (extends auth.users)
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY, -- Connects to auth.users later if needed
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    role VARCHAR(20) CHECK (role IN ('OWNER','MANAGER','STAFF_GUDANG','STAFF_DAPUR')),
    phone VARCHAR(20),
    photo_url TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Table: stock_transactions
CREATE TABLE IF NOT EXISTS public.stock_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL CHECK (type IN ('IN','OUT','WASTE','ADJUSTMENT','OPNAME')),
    quantity INTEGER NOT NULL,
    user_id UUID REFERENCES public.users(id),
    reference VARCHAR(100),
    notes TEXT,
    stock_before INTEGER NOT NULL DEFAULT 0,
    stock_after INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Table: attendance
CREATE TABLE IF NOT EXISTS public.attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    check_type VARCHAR(10) CHECK (check_type IN ('IN','OUT')),
    timestamp TIMESTAMPTZ DEFAULT now(),
    latitude DECIMAL(10,7),
    longitude DECIMAL(10,7),
    distance_from_office INTEGER,
    photo_url TEXT,
    status VARCHAR(20) CHECK (status IN ('ONTIME','LATE','EARLY_LEAVE','OUT_OF_RANGE')),
    notes TEXT
);

-- 5. Table: purchase_orders
CREATE TABLE IF NOT EXISTS public.purchase_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    po_number VARCHAR(30) UNIQUE NOT NULL,
    product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL,
    unit_price INTEGER,
    total_price INTEGER,
    status VARCHAR(30) CHECK (status IN ('PENDING_MANAGER','PENDING_OWNER','APPROVED','REJECTED','FULFILLED')),
    requester_id UUID REFERENCES public.users(id),
    approver_id UUID REFERENCES public.users(id),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    approved_at TIMESTAMPTZ
);

-- 6. Table: restaurant_config
CREATE TABLE IF NOT EXISTS public.restaurant_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_name VARCHAR(100),
    office_lat DECIMAL(10,7),
    office_lng DECIMAL(10,7),
    radius_meter INTEGER DEFAULT 100,
    work_start_time TIME DEFAULT '08:00',
    work_end_time TIME DEFAULT '17:00',
    late_tolerance_minutes INTEGER DEFAULT 15
);

-- ==========================================
-- INDEXES
-- ==========================================
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category);
CREATE INDEX IF NOT EXISTS idx_products_barcode ON public.products(barcode);
CREATE INDEX IF NOT EXISTS idx_stock_tx_product_date ON public.stock_transactions(product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_tx_user_date ON public.stock_transactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_user_date ON public.attendance(user_id, timestamp DESC);

-- ==========================================
-- TRIGGERS: Auto Update current_stock
-- ==========================================
CREATE OR REPLACE FUNCTION update_product_stock()
RETURNS TRIGGER AS $$
DECLARE
    cur_stock INTEGER;
BEGIN
    -- Get current stock
    SELECT current_stock INTO cur_stock FROM products WHERE id = NEW.product_id;
    NEW.stock_before := cur_stock;

    -- Calculate new stock
    IF NEW.type = 'IN' THEN
        NEW.stock_after := cur_stock + NEW.quantity;
    ELSIF NEW.type IN ('OUT', 'WASTE') THEN
        NEW.stock_after := cur_stock - NEW.quantity;
    ELSIF NEW.type IN ('ADJUSTMENT', 'OPNAME') THEN
        NEW.stock_after := NEW.quantity;
    END IF;

    -- Update product table
    UPDATE products 
    SET current_stock = NEW.stock_after, updated_at = now()
    WHERE id = NEW.product_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_stock_transaction
BEFORE INSERT ON stock_transactions
FOR EACH ROW EXECUTE FUNCTION update_product_stock();

-- ==========================================
-- RLS POLICIES (Row Level Security)
-- ==========================================
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_config ENABLE ROW LEVEL SECURITY;

-- Allow reading all for authenticated users (as demo baseline)
CREATE POLICY "Allow read for all authenticated users" 
ON public.products FOR SELECT USING (true); -- Usually restricted by auth.uid() in real apps

-- Manager/Owner open policy dummy (Replace true with role logic)
CREATE POLICY "Allow all actions for staff" 
ON public.stock_transactions FOR ALL USING (true);

CREATE POLICY "Allow all actions for attendance" 
ON public.attendance FOR ALL USING (true);
