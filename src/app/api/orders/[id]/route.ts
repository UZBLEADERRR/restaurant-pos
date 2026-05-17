import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getAdminSession } from "@/lib/auth";

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();

  // Toggle order item completion
  if (body.item_id !== undefined && body.is_completed !== undefined) {
    const { data, error } = await supabaseAdmin
      .from("order_items")
      .update({ is_completed: body.is_completed })
      .eq("id", body.item_id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }

  // Remove an order item (and update total)
  if (body.remove_item_id) {
    // Get the item first to know its price/qty
    const { data: item, error: fetchErr } = await supabaseAdmin
      .from("order_items")
      .select("price, quantity")
      .eq("id", body.remove_item_id)
      .single();

    if (fetchErr || !item) return NextResponse.json({ error: "Item not found" }, { status: 404 });

    const { error: delErr } = await supabaseAdmin
      .from("order_items")
      .delete()
      .eq("id", body.remove_item_id);

    if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });

    // Recalculate order total from remaining items
    const { data: remaining } = await supabaseAdmin
      .from("order_items")
      .select("price, quantity")
      .eq("order_id", params.id);

    const newTotal = (remaining || []).reduce((s, i) => s + i.price * i.quantity, 0);
    await supabaseAdmin.from("orders").update({ total_amount: newTotal }).eq("id", params.id);

    return NextResponse.json({ success: true, total_amount: newTotal });
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
