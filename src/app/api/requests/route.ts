import { NextResponse } from "next/server";
import { supabase, supabaseAdmin } from "@/lib/supabase";
import { getAdminSession } from "@/lib/auth";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const restaurantId = searchParams.get("restaurant_id");
  const session = await getAdminSession();

  const rid = restaurantId || session?.id;

  let q = supabase
    .from("customer_requests")
    .select("*, restaurant_tables(*)")
    .eq("is_completed", false)
    .order("created_at", { ascending: true });

  if (rid) {
    const { data, error } = await q.eq("restaurant_id", rid);
    if (!error) return NextResponse.json(data ?? []);
    if (error.message?.includes("restaurant_id")) {
      // Fallback
      const { data: d2 } = await supabase
        .from("customer_requests")
        .select("*, restaurant_tables(*)")
        .eq("is_completed", false)
        .order("created_at", { ascending: true });
      return NextResponse.json(d2 ?? []);
    }
  }

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: Request) {
  const body = await req.json();
  const { table_id, order_id, message, restaurant_id } = body;

  const payload: Record<string, unknown> = { table_id, order_id, message };
  if (restaurant_id) payload.restaurant_id = restaurant_id;

  const { data, error } = await supabase
    .from("customer_requests")
    .insert(payload)
    .select()
    .single();

  if (!error) return NextResponse.json(data);

  if (error.message?.includes("restaurant_id")) {
    const { data: d2, error: e2 } = await supabase
      .from("customer_requests")
      .insert({ table_id, order_id, message })
      .select()
      .single();
    if (e2) return NextResponse.json({ error: e2.message }, { status: 500 });
    return NextResponse.json(d2);
  }

  return NextResponse.json({ error: error.message }, { status: 500 });
}

export async function PATCH(req: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, is_completed } = await req.json();
  const { data, error } = await supabaseAdmin
    .from("customer_requests")
    .update({ is_completed })
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
