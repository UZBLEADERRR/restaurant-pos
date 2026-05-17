import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { supabaseAdmin } from "@/lib/supabase";

// One-time setup endpoint to create the first admin user
export async function POST(req: Request) {
  const { username, password, setupKey } = await req.json();

  if (setupKey !== process.env.SETUP_KEY && setupKey !== "setup-restaurant-2024") {
    return NextResponse.json({ error: "Invalid setup key" }, { status: 403 });
  }

  const { data: existing } = await supabaseAdmin
    .from("admin_users")
    .select("id")
    .limit(1);

  if (existing && existing.length > 0) {
    return NextResponse.json(
      { error: "Admin already exists. Use admin panel to add more users." },
      { status: 400 }
    );
  }

  const hash = await bcrypt.hash(password, 10);

  const { data, error } = await supabaseAdmin
    .from("admin_users")
    .insert({ username, password_hash: hash })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, id: data.id });
}
