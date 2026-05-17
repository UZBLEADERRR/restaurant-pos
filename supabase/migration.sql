-- Migration: Add restaurant_id (multi-tenancy) + is_sold_out
-- Run this in Supabase SQL Editor

ALTER TABLE restaurant_tables ADD COLUMN IF NOT EXISTS restaurant_id UUID REFERENCES admin_users(id) ON DELETE CASCADE;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS restaurant_id UUID REFERENCES admin_users(id) ON DELETE CASCADE;
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS restaurant_id UUID REFERENCES admin_users(id) ON DELETE CASCADE;
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS is_sold_out BOOLEAN DEFAULT false;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS restaurant_id UUID;
ALTER TABLE customer_requests ADD COLUMN IF NOT EXISTS restaurant_id UUID;

-- IMPORTANT: Link existing demo data to the first admin user
-- (Run this after creating your admin account via /admin/setup)
UPDATE restaurant_tables
  SET restaurant_id = (SELECT id FROM admin_users ORDER BY created_at LIMIT 1)
  WHERE restaurant_id IS NULL;

UPDATE categories
  SET restaurant_id = (SELECT id FROM admin_users ORDER BY created_at LIMIT 1)
  WHERE restaurant_id IS NULL;

UPDATE menu_items
  SET restaurant_id = (SELECT id FROM admin_users ORDER BY created_at LIMIT 1)
  WHERE restaurant_id IS NULL;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_tables_restaurant ON restaurant_tables(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_categories_restaurant ON categories(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_restaurant ON menu_items(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_orders_restaurant ON orders(restaurant_id);
