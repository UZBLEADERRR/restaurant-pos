import { NextResponse } from "next/server";
import { supabase, supabaseAdmin } from "@/lib/supabase";
import { getAdminSession } from "@/lib/auth";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const restaurantId = searchParams.get("restaurant_id");

  if (restaurantId) {
    const { data, error } = await supabase
      .from("categories")
      .select("*")
      .eq("restaurant_id", restaurantId)
      .eq("is_active", true)
      .order("sort_order");

    if (!error) return NextResponse.json(data ?? []);
  }

  // Fallback (migration not run yet)
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .eq("is_active", true)
    .order("sort_order");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();

  const { data, error } = await supabaseAdmin
    .from("categories")
    .insert({ ...body, restaurant_id: session.id })
    .select()
    .single();

  if (!error) return NextResponse.json(data);

  if (error.message?.includes("restaurant_id")) {
    const { data: d2, error: e2 } = await supabaseAdmin
      .from("categories")
      .insert(body)
      .select()
      .single();
    if (e2) return NextResponse.json({ error: e2.message }, { status: 500 });
    return NextResponse.json(d2);
  }

  return NextResponse.json({ error: error.message }, { status: 500 });
}
