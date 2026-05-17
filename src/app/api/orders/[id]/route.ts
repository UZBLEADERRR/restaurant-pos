import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getAdminSession } from "@/lib/auth";

// Toggle order item completion
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();

  // If toggling an order item
  if (body.item_id !== undefined) {
    const { data, error } = await supabaseAdmin
      .from("order_items")
      .update({ is_completed: body.is_completed })
      .eq("id", body.item_id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }

  // Adding manual item to existing order
  if (body.add_item) {
    const item = body.add_item;
    const { data, error } = await supabaseAdmin
      .from("order_items")
      .insert({
        order_id: params.id,
        menu_item_id: item.menu_item_id || null,
        name_ko: item.name_ko,
        name_en: item.name_en,
        price: item.price,
        quantity: item.quantity || 1,
        staff_type: item.staff_type,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Update order total directly
    const { data: currentOrder } = await supabaseAdmin
      .from("orders")
      .select("total_amount")
      .eq("id", params.id)
      .single();
    await supabaseAdmin
      .from("orders")
      .update({ total_amount: (currentOrder?.total_amount || 0) + item.price * (item.quantity || 1) })
      .eq("id", params.id);

    return NextResponse.json(data);
  }

  return NextResponse.json({ error: "Invalid request" }, { status: 400 });
}
