import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getAdminSession } from "@/lib/auth";

// Deletes paid orders older than 1 day (and their related items/requests)
export async function POST(req: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  // Find old paid orders for this restaurant
  const { data: oldOrders } = await supabaseAdmin
    .from("orders")
    .select("id")
    .eq("restaurant_id", session.id)
    .eq("status", "paid")
    .lt("paid_at", cutoff);

  if (!oldOrders || oldOrders.length === 0) {
    return NextResponse.json({ deleted: 0 });
  }

  const ids = oldOrders.map((o) => o.id);

  // Delete related data first (cascade may not be set up)
  await supabaseAdmin.from("order_items").delete().in("order_id", ids);
  await supabaseAdmin.from("customer_requests").delete().in("order_id", ids);
  const { error } = await supabaseAdmin.from("orders").delete().in("id", ids);

  if (error) {
    // Fallback: try without restaurant_id filter (for users who haven't migrated)
    const { data: oldOrders2 } = await supabaseAdmin
      .from("orders")
      .select("id")
      .eq("status", "paid")
      .lt("paid_at", cutoff);

    if (oldOrders2 && oldOrders2.length > 0) {
      const ids2 = oldOrders2.map((o) => o.id);
      await supabaseAdmin.from("order_items").delete().in("order_id", ids2);
      await supabaseAdmin.from("customer_requests").delete().in("order_id", ids2);
      await supabaseAdmin.from("orders").delete().in("id", ids2);
    }
  }

  return NextResponse.json({ deleted: ids.length });
}
