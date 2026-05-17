-- Migration: Add restaurant_id (multi-tenancy) + is_sold_out

ALTER TABLE restaurant_tables ADD COLUMN IF NOT EXISTS restaurant_id UUID REFERENCES admin_users(id) ON DELETE CASCADE;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS restaurant_id UUID REFERENCES admin_users(id) ON DELETE CASCADE;
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS restaurant_id UUID REFERENCES admin_users(id) ON DELETE CASCADE;
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS is_sold_out BOOLEAN DEFAULT false;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS restaurant_id UUID;
ALTER TABLE customer_requests ADD COLUMN IF NOT EXISTS restaurant_id UUID;

-- Update existing data (if any) – link to first admin
-- UPDATE restaurant_tables SET restaurant_id = (SELECT id FROM admin_users LIMIT 1) WHERE restaurant_id IS NULL;
-- UPDATE categories SET restaurant_id = (SELECT id FROM admin_users LIMIT 1) WHERE restaurant_id IS NULL;
-- UPDATE menu_items SET restaurant_id = (SELECT id FROM admin_users LIMIT 1) WHERE restaurant_id IS NULL;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_tables_restaurant ON restaurant_tables(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_categories_restaurant ON categories(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_restaurant ON menu_items(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_orders_restaurant ON orders(restaurant_id);
