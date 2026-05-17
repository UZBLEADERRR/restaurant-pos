import { NextResponse } from "next/server";
import { supabase, supabaseAdmin } from "@/lib/supabase";
import { getAdminSession } from "@/lib/auth";

export async function GET() {
  const { data, error } = await supabase
    .from("customer_requests")
    .select("*, restaurant_tables(*)")
    .eq("is_completed", false)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: Request) {
  const body = await req.json();
  const { table_id, order_id, message } = body;

  const { data, error } = await supabase
    .from("customer_requests")
    .insert({ table_id, order_id, message })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
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
