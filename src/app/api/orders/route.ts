import { NextResponse } from "next/server";
import { supabase, supabaseAdmin } from "@/lib/supabase";
import { getAdminSession } from "@/lib/auth";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const tableId = searchParams.get("table_id");
  const status = searchParams.get("status") || "active";
  const restaurantId = searchParams.get("restaurant_id");

  const session = await getAdminSession();

  let query = supabase
    .from("orders")
    .select("*, restaurant_tables(*), order_items(*), customer_requests(*)")
    .eq("status", status)
    .order("created_at", { ascending: false });

  if (tableId) query = query.eq("table_id", tableId);
  if (restaurantId) query = query.eq("restaurant_id", restaurantId);
  else if (session) query = query.eq("restaurant_id", session.id);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: Request) {
  const body = await req.json();
  const { table_id, items, restaurant_id } = body;

  if (!restaurant_id) {
    return NextResponse.json({ error: "restaurant_id required" }, { status: 400 });
  }

  // Find or create active order
  let orderId: string;
  const { data: existing } = await supabase
    .from("orders")
    .select("id, total_amount")
    .eq("table_id", table_id)
    .eq("restaurant_id", restaurant_id)
    .eq("status", "active")
    .single();

  if (existing) {
    orderId = existing.id;
  } else {
    const { data: newOrder, error: orderError } = await supabase
      .from("orders")
      .insert({ table_id, restaurant_id, status: "active", total_amount: 0 })
      .select()
      .single();

    if (orderError || !newOrder)
      return NextResponse.json({ error: "Failed to create order" }, { status: 500 });
    orderId = newOrder.id;
  }

  const orderItems = items.map((item: {
    menu_item_id: string; name_ko: string; name_en: string;
    price: number; quantity: number; staff_type: string;
  }) => ({
    order_id: orderId,
    menu_item_id: item.menu_item_id,
    name_ko: item.name_ko, name_en: item.name_en,
    price: item.price, quantity: item.quantity, staff_type: item.staff_type,
  }));

  const { error: itemsError } = await supabase.from("order_items").insert(orderItems);
  if (itemsError) return NextResponse.json({ error: itemsError.message }, { status: 500 });

  const added = items.reduce((s: number, i: { price: number; quantity: number }) => s + i.price * i.quantity, 0);
  const { data: cur } = await supabase.from("orders").select("total_amount").eq("id", orderId).single();
  await supabase.from("orders").update({ total_amount: (cur?.total_amount || 0) + added }).eq("id", orderId);

  return NextResponse.json({ success: true, order_id: orderId });
}

export async function PATCH(req: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, status } = await req.json();
  const updateData: { status: string; paid_at?: string } = { status };
  if (status === "paid") updateData.paid_at = new Date().toISOString();

  const { data, error } = await supabaseAdmin
    .from("orders")
    .update(updateData)
    .eq("id", id)
    .eq("restaurant_id", session.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
