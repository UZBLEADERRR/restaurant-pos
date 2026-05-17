import { NextResponse } from "next/server";
import { supabase, supabaseAdmin } from "@/lib/supabase";
import { getAdminSession } from "@/lib/auth";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const tableId = searchParams.get("table_id");
  const status = searchParams.get("status") || "active";

  let query = supabase
    .from("orders")
    .select("*, restaurant_tables(*), order_items(*), customer_requests(*)")
    .eq("status", status)
    .order("created_at", { ascending: false });

  if (tableId) {
    query = query.eq("table_id", tableId);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: Request) {
  const body = await req.json();
  const { table_id, items } = body;

  // Find or create active order for this table
  let orderId: string;

  const { data: existingOrder } = await supabase
    .from("orders")
    .select("id, total_amount")
    .eq("table_id", table_id)
    .eq("status", "active")
    .single();

  if (existingOrder) {
    orderId = existingOrder.id;
  } else {
    const { data: newOrder, error: orderError } = await supabase
      .from("orders")
      .insert({ table_id, status: "active", total_amount: 0 })
      .select()
      .single();

    if (orderError || !newOrder) {
      return NextResponse.json({ error: "Failed to create order" }, { status: 500 });
    }
    orderId = newOrder.id;
  }

  // Insert order items
  const orderItems = items.map(
    (item: {
      menu_item_id: string;
      name_ko: string;
      name_en: string;
      price: number;
      quantity: number;
      staff_type: string;
    }) => ({
      order_id: orderId,
      menu_item_id: item.menu_item_id,
      name_ko: item.name_ko,
      name_en: item.name_en,
      price: item.price,
      quantity: item.quantity,
      staff_type: item.staff_type,
    })
  );

  const { error: itemsError } = await supabase
    .from("order_items")
    .insert(orderItems);

  if (itemsError) {
    return NextResponse.json({ error: itemsError.message }, { status: 500 });
  }

  // Update total amount
  const addedTotal = items.reduce(
    (sum: number, i: { price: number; quantity: number }) =>
      sum + i.price * i.quantity,
    0
  );

  const { data: currentOrder } = await supabase
    .from("orders")
    .select("total_amount")
    .eq("id", orderId)
    .single();

  await supabase
    .from("orders")
    .update({
      total_amount: (currentOrder?.total_amount || 0) + addedTotal,
    })
    .eq("id", orderId);

  return NextResponse.json({ success: true, order_id: orderId });
}

export async function PATCH(req: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, status } = await req.json();

  const updateData: { status: string; paid_at?: string } = { status };
  if (status === "paid") {
    updateData.paid_at = new Date().toISOString();
  }

  const { data, error } = await supabaseAdmin
    .from("orders")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
