import { NextResponse } from "next/server";
import { supabase, supabaseAdmin } from "@/lib/supabase";
import { getAdminSession } from "@/lib/auth";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const restaurantId = searchParams.get("restaurant_id");

  // Try with restaurant_id filter first; fall back to unfiltered if column missing
  if (restaurantId) {
    const { data, error } = await supabase
      .from("restaurant_tables")
      .select("*")
      .eq("restaurant_id", restaurantId)
      .order("number");

    if (!error) return NextResponse.json(data ?? []);
    // Column probably doesn't exist yet — fall through to unfiltered
  }

  const { data, error } = await supabase
    .from("restaurant_tables")
    .select("*")
    .order("number");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { number, name, capacity } = await req.json();

  // Try with restaurant_id; fall back without if column missing
  const payload: Record<string, unknown> = {
    number,
    name: name || `${number}번 테이블`,
    capacity: capacity || 4,
  };

  // First attempt: with restaurant_id
  const { data, error } = await supabaseAdmin
    .from("restaurant_tables")
    .insert({ ...payload, restaurant_id: session.id })
    .select()
    .single();

  if (!error) return NextResponse.json(data);

  // If column missing, try without restaurant_id
  if (error.message?.includes("restaurant_id")) {
    const { data: data2, error: error2 } = await supabaseAdmin
      .from("restaurant_tables")
      .insert(payload)
      .select()
      .single();

    if (error2) return NextResponse.json({ error: error2.message }, { status: 500 });
    return NextResponse.json(data2);
  }

  return NextResponse.json({ error: error.message }, { status: 500 });
}
