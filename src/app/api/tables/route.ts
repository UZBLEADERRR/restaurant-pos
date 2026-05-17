import { NextResponse } from "next/server";
import { supabase, supabaseAdmin } from "@/lib/supabase";
import { getAdminSession } from "@/lib/auth";

export async function GET() {
  const { data, error } = await supabase
    .from("restaurant_tables")
    .select("*")
    .order("number");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { number, name, capacity } = body;

  const { data, error } = await supabaseAdmin
    .from("restaurant_tables")
    .insert({ number, name: name || `${number}번 테이블`, capacity: capacity || 4 })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
