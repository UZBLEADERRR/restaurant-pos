import { createClient } from "@supabase/supabase-js";

function createSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder"
  );
}

function createSupabaseAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
    process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder",
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

// Lazy singletons — created on first access, never at import time
let _client: ReturnType<typeof createSupabaseClient> | null = null;
let _adminClient: ReturnType<typeof createSupabaseAdminClient> | null = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const supabase = new Proxy({} as ReturnType<typeof createSupabaseClient>, {
  get(_target, prop) {
    if (!_client) _client = createSupabaseClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (_client as any)[prop];
  },
});

export const supabaseAdmin = new Proxy(
  {} as ReturnType<typeof createSupabaseAdminClient>,
  {
    get(_target, prop) {
      if (!_adminClient) _adminClient = createSupabaseAdminClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (_adminClient as any)[prop];
    },
  }
);

export type Table = {
  id: string;
  number: number;
  name: string;
  capacity: number;
  is_active: boolean;
  created_at: string;
};

export type Category = {
  id: string;
  name_ko: string;
  name_en: string;
  staff_type: "kitchen" | "hall";
  sort_order: number;
  is_active: boolean;
};

export type MenuItem = {
  id: string;
  category_id: string;
  name_ko: string;
  name_en: string;
  price: number;
  description_ko: string;
  description_en: string;
  image_url: string;
  staff_type: "kitchen" | "hall";
  is_available: boolean;
  sort_order: number;
  categories?: Category;
};

export type Order = {
  id: string;
  table_id: string;
  status: "active" | "paid";
  total_amount: number;
  created_at: string;
  paid_at: string | null;
  restaurant_tables?: Table;
};

export type OrderItem = {
  id: string;
  order_id: string;
  menu_item_id: string;
  name_ko: string;
  name_en: string;
  price: number;
  quantity: number;
  staff_type: "kitchen" | "hall";
  is_completed: boolean;
  created_at: string;
};

export type CustomerRequest = {
  id: string;
  table_id: string;
  order_id: string;
  message: string;
  is_completed: boolean;
  created_at: string;
  restaurant_tables?: Table;
};
