-- Restaurant POS System Database Schema
-- Run this in Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Admin Users
CREATE TABLE IF NOT EXISTS admin_users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Restaurant Tables
CREATE TABLE IF NOT EXISTS restaurant_tables (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  number INTEGER NOT NULL UNIQUE,
  name TEXT,
  capacity INTEGER DEFAULT 4,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Menu Categories
CREATE TABLE IF NOT EXISTS categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name_ko TEXT NOT NULL,
  name_en TEXT NOT NULL,
  staff_type TEXT NOT NULL DEFAULT 'kitchen' CHECK (staff_type IN ('kitchen', 'hall')),
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Menu Items
CREATE TABLE IF NOT EXISTS menu_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  name_ko TEXT NOT NULL,
  name_en TEXT NOT NULL,
  price INTEGER NOT NULL,
  description_ko TEXT DEFAULT '',
  description_en TEXT DEFAULT '',
  image_url TEXT DEFAULT '',
  staff_type TEXT NOT NULL DEFAULT 'kitchen' CHECK (staff_type IN ('kitchen', 'hall')),
  is_available BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Orders (active session per table)
CREATE TABLE IF NOT EXISTS orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  table_id UUID REFERENCES restaurant_tables(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paid')),
  total_amount INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  paid_at TIMESTAMPTZ
);

-- Order Items
CREATE TABLE IF NOT EXISTS order_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  menu_item_id UUID REFERENCES menu_items(id) ON DELETE SET NULL,
  name_ko TEXT NOT NULL,
  name_en TEXT NOT NULL,
  price INTEGER NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  staff_type TEXT NOT NULL DEFAULT 'kitchen' CHECK (staff_type IN ('kitchen', 'hall')),
  is_completed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Customer Requests (spoon, fork, etc.)
CREATE TABLE IF NOT EXISTS customer_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  table_id UUID REFERENCES restaurant_tables(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  is_completed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_requests ENABLE ROW LEVEL SECURITY;

-- Allow public read access to tables, categories, menu_items
CREATE POLICY "Public read restaurant_tables" ON restaurant_tables FOR SELECT USING (true);
CREATE POLICY "Public read categories" ON categories FOR SELECT USING (true);
CREATE POLICY "Public read menu_items" ON menu_items FOR SELECT USING (true);
CREATE POLICY "Public read orders" ON orders FOR SELECT USING (true);
CREATE POLICY "Public read order_items" ON order_items FOR SELECT USING (true);
CREATE POLICY "Public read customer_requests" ON customer_requests FOR SELECT USING (true);

-- Allow public insert for orders, order_items, customer_requests (customers ordering)
CREATE POLICY "Public insert orders" ON orders FOR INSERT WITH CHECK (true);
CREATE POLICY "Public insert order_items" ON order_items FOR INSERT WITH CHECK (true);
CREATE POLICY "Public insert customer_requests" ON customer_requests FOR INSERT WITH CHECK (true);

-- Service role has full access (admin operations via service role key)
CREATE POLICY "Service role full access admin_users" ON admin_users USING (true);
CREATE POLICY "Service role full access restaurant_tables" ON restaurant_tables FOR ALL USING (true);
CREATE POLICY "Service role full access categories" ON categories FOR ALL USING (true);
CREATE POLICY "Service role full access menu_items" ON menu_items FOR ALL USING (true);
CREATE POLICY "Service role full access orders" ON orders FOR ALL USING (true);
CREATE POLICY "Service role full access order_items" ON order_items FOR ALL USING (true);
CREATE POLICY "Service role full access customer_requests" ON customer_requests FOR ALL USING (true);

-- Enable realtime on tables
ALTER PUBLICATION supabase_realtime ADD TABLE orders;
ALTER PUBLICATION supabase_realtime ADD TABLE order_items;
ALTER PUBLICATION supabase_realtime ADD TABLE customer_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE restaurant_tables;

-- Sample data
INSERT INTO categories (name_ko, name_en, staff_type, sort_order) VALUES
  ('메인 요리', 'Main Dishes', 'kitchen', 1),
  ('사이드 메뉴', 'Side Dishes', 'kitchen', 2),
  ('음료', 'Beverages', 'hall', 3),
  ('주류', 'Alcoholic', 'hall', 4);

INSERT INTO menu_items (name_ko, name_en, price, staff_type, sort_order, category_id)
SELECT '된장찌개', 'Doenjang Jjigae', 9000, 'kitchen', 1, id FROM categories WHERE name_en = 'Main Dishes';

INSERT INTO menu_items (name_ko, name_en, price, staff_type, sort_order, category_id)
SELECT '비빔밥', 'Bibimbap', 10000, 'kitchen', 2, id FROM categories WHERE name_en = 'Main Dishes';

INSERT INTO menu_items (name_ko, name_en, price, staff_type, sort_order, category_id)
SELECT '김치찌개', 'Kimchi Jjigae', 9000, 'kitchen', 3, id FROM categories WHERE name_en = 'Main Dishes';

INSERT INTO menu_items (name_ko, name_en, price, staff_type, sort_order, category_id)
SELECT '공기밥', 'Steamed Rice', 1000, 'kitchen', 1, id FROM categories WHERE name_en = 'Side Dishes';

INSERT INTO menu_items (name_ko, name_en, price, staff_type, sort_order, category_id)
SELECT '콜라', 'Coca-Cola', 2000, 'hall', 1, id FROM categories WHERE name_en = 'Beverages';

INSERT INTO menu_items (name_ko, name_en, price, staff_type, sort_order, category_id)
SELECT '사이다', 'Sprite', 2000, 'hall', 2, id FROM categories WHERE name_en = 'Beverages';

INSERT INTO menu_items (name_ko, name_en, price, staff_type, sort_order, category_id)
SELECT '소주', 'Soju', 5000, 'hall', 1, id FROM categories WHERE name_en = 'Alcoholic';

INSERT INTO restaurant_tables (number, name, capacity) VALUES
  (1, '1번 테이블', 4),
  (2, '2번 테이블', 4),
  (3, '3번 테이블', 2),
  (4, '4번 테이블', 6);
