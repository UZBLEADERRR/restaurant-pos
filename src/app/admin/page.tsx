"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase, Order, OrderItem, CustomerRequest, Table } from "@/lib/supabase";

type ViewMode = "grid" | "queue";
type StaffFilter = "all" | "kitchen" | "hall";

type OrderWithItems = Order & {
  order_items: OrderItem[];
  customer_requests: CustomerRequest[];
  restaurant_tables: Table;
};

export default function AdminDashboard() {
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [requests, setRequests] = useState<CustomerRequest[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [staffFilter, setStaffFilter] = useState<StaffFilter>("all");
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<OrderWithItems | null>(null);
  const [showAddItem, setShowAddItem] = useState(false);
  const [addItemForm, setAddItemForm] = useState({
    name_ko: "", name_en: "", price: "", quantity: "1", staff_type: "kitchen"
  });

  const fetchData = useCallback(async () => {
    const [ordersRes, requestsRes] = await Promise.all([
      fetch("/api/orders?status=active"),
      fetch("/api/requests"),
    ]);
    const [ordersData, requestsData] = await Promise.all([
      ordersRes.json(),
      requestsRes.json(),
    ]);
    if (Array.isArray(ordersData)) setOrders(ordersData);
    if (Array.isArray(requestsData)) setRequests(requestsData);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();

    // Real-time subscriptions
    const ordersSub = supabase
      .channel("orders-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, fetchData)
      .on("postgres_changes", { event: "*", schema: "public", table: "order_items" }, fetchData)
      .subscribe();

    const reqSub = supabase
      .channel("requests-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "customer_requests" }, fetchData)
      .subscribe();

    return () => {
      supabase.removeChannel(ordersSub);
      supabase.removeChannel(reqSub);
    };
  }, [fetchData]);

  const toggleItem = async (orderId: string, itemId: string, current: boolean) => {
    await fetch(`/api/orders/${orderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ item_id: itemId, is_completed: !current }),
    });
    fetchData();
  };

  const markPaid = async (orderId: string) => {
    if (!confirm("결제 완료 처리하시겠습니까?")) return;
    await fetch("/api/orders", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: orderId, status: "paid" }),
    });
    setSelectedOrder(null);
    fetchData();
  };

  const completeRequest = async (id: string) => {
    await fetch("/api/requests", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, is_completed: true }),
    });
    fetchData();
  };

  const addManualItem = async (orderId: string) => {
    if (!addItemForm.name_ko || !addItemForm.price) return;
    await fetch(`/api/orders/${orderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        add_item: {
          name_ko: addItemForm.name_ko,
          name_en: addItemForm.name_en || addItemForm.name_ko,
          price: parseInt(addItemForm.price),
          quantity: parseInt(addItemForm.quantity),
          staff_type: addItemForm.staff_type,
        },
      }),
    });
    setAddItemForm({ name_ko: "", name_en: "", price: "", quantity: "1", staff_type: "kitchen" });
    setShowAddItem(false);
    fetchData();
  };

  // Queue mode: all pending items across all tables, sorted by time
  const queueItems = orders
    .flatMap((order) =>
      order.order_items
        .filter((item) => {
          if (item.is_completed) return false;
          if (staffFilter !== "all" && item.staff_type !== staffFilter) return false;
          return true;
        })
        .map((item) => ({
          ...item,
          table_number: order.restaurant_tables?.number,
          table_name: order.restaurant_tables?.name,
          order_id: order.id,
        }))
    )
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  const pendingCount = orders
    .flatMap((o) => o.order_items)
    .filter((i) => !i.is_completed).length;

  const filteredOrders = orders.filter((o) => {
    if (staffFilter === "all") return true;
    return o.order_items.some((item) => item.staff_type === staffFilter);
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="text-4xl mb-2 animate-spin">⟳</div>
          <p className="text-gray-400">로딩 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="sm:ml-56 min-h-screen bg-gray-50 pb-20 sm:pb-0">
      {/* Dashboard Header */}
      <div className="bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <h1 className="font-bold text-gray-800 text-lg">대시보드</h1>
          {pendingCount > 0 && (
            <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full font-bold animate-pulse">
              {pendingCount} 대기
            </span>
          )}
          {requests.length > 0 && (
            <span className="bg-orange-400 text-white text-xs px-2 py-0.5 rounded-full font-bold animate-pulse">
              📣 {requests.length} 요청
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Staff filter */}
          <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
            {(["all", "kitchen", "hall"] as StaffFilter[]).map((f) => (
              <button
                key={f}
                onClick={() => setStaffFilter(f)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${staffFilter === f ? "bg-kakao-yellow text-kakao-brown" : "text-gray-500"}`}
              >
                {f === "all" ? "전체" : f === "kitchen" ? "🍳 주방" : "🍺 홀"}
              </button>
            ))}
          </div>
          {/* View toggle */}
          <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
            <button
              onClick={() => setViewMode("grid")}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${viewMode === "grid" ? "bg-kakao-yellow text-kakao-brown" : "text-gray-500"}`}
            >
              🪑 테이블
            </button>
            <button
              onClick={() => setViewMode("queue")}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${viewMode === "queue" ? "bg-kakao-yellow text-kakao-brown" : "text-gray-500"}`}
            >
              📋 순서
            </button>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Customer Requests */}
        {requests.length > 0 && (
          <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4">
            <h2 className="font-bold text-orange-700 mb-3 flex items-center gap-2">
              <span>📣</span> 고객 요청사항
            </h2>
            <div className="space-y-2">
              {requests.map((req) => (
                <div
                  key={req.id}
                  className="bg-white rounded-xl p-3 flex items-center justify-between gap-3 shadow-sm"
                >
                  <div className="flex-1">
                    <span className="text-xs font-bold text-orange-500 bg-orange-100 px-2 py-0.5 rounded-full">
                      {req.restaurant_tables?.name || "알 수 없는 테이블"}
                    </span>
                    <p className="text-sm text-gray-700 mt-1">{req.message}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(req.created_at).toLocaleTimeString("ko-KR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                  <button
                    onClick={() => completeRequest(req.id)}
                    className="flex-shrink-0 bg-green-500 text-white text-xs px-3 py-2 rounded-xl font-bold hover:bg-green-600"
                  >
                    ✓ 완료
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Queue View */}
        {viewMode === "queue" && (
          <div className="space-y-2">
            <h2 className="font-bold text-gray-700 text-sm px-1">
              대기 순서 ({queueItems.length}개)
            </h2>
            {queueItems.length === 0 ? (
              <div className="bg-white rounded-2xl p-8 text-center text-gray-400">
                모든 주문이 완료되었습니다 ✅
              </div>
            ) : (
              queueItems.map((item, idx) => (
                <div
                  key={item.id}
                  className="bg-white rounded-2xl p-4 flex items-center gap-3 shadow-sm"
                >
                  <span className="text-2xl font-black text-gray-200 w-8">
                    {idx + 1}
                  </span>
                  <div
                    className={`w-2 h-12 rounded-full flex-shrink-0 ${item.staff_type === "kitchen" ? "bg-red-400" : "bg-blue-400"}`}
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-gray-400">
                        {item.table_name}
                      </span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${item.staff_type === "kitchen" ? "bg-red-100 text-red-600" : "bg-blue-100 text-blue-600"}`}
                      >
                        {item.staff_type === "kitchen" ? "주방" : "홀"}
                      </span>
                    </div>
                    <p className="font-semibold text-gray-800">
                      {item.name_ko}
                    </p>
                    <p className="text-xs text-gray-400">
                      {item.quantity}개 · {new Date(item.created_at).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                  <button
                    onClick={() => toggleItem(item.order_id, item.id, false)}
                    className="flex-shrink-0 w-10 h-10 rounded-xl bg-green-50 border-2 border-green-200 flex items-center justify-center text-green-600 hover:bg-green-500 hover:text-white transition-colors"
                  >
                    ✓
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {/* Grid View - Tables */}
        {viewMode === "grid" && (
          <>
            {filteredOrders.length === 0 ? (
              <div className="bg-white rounded-2xl p-12 text-center text-gray-400 shadow-sm">
                <p className="text-4xl mb-3">🪑</p>
                <p>현재 활성 주문이 없습니다</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredOrders.map((order) => {
                  const filteredItems =
                    staffFilter === "all"
                      ? order.order_items
                      : order.order_items.filter(
                          (i) => i.staff_type === staffFilter
                        );
                  const pending = filteredItems.filter((i) => !i.is_completed).length;
                  const total = filteredItems.length;

                  return (
                    <div
                      key={order.id}
                      onClick={() => setSelectedOrder(order)}
                      className={`bg-white rounded-2xl p-4 shadow-sm cursor-pointer hover:shadow-md transition-shadow border-2 ${pending > 0 ? "border-kakao-yellow" : "border-transparent"}`}
                    >
                      {/* Table header */}
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h3 className="font-bold text-gray-800">
                            {order.restaurant_tables?.name}
                          </h3>
                          <p className="text-xs text-gray-400">
                            {new Date(order.created_at).toLocaleTimeString("ko-KR", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                        </div>
                        <div className="text-right">
                          {pending > 0 && (
                            <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full font-bold block mb-1">
                              {pending} 대기
                            </span>
                          )}
                          <span className="text-xs text-gray-400">
                            {total - pending}/{total} 완료
                          </span>
                        </div>
                      </div>

                      {/* Progress bar */}
                      <div className="h-1.5 bg-gray-100 rounded-full mb-3">
                        <div
                          className="h-full bg-green-400 rounded-full transition-all"
                          style={{
                            width: total > 0 ? `${((total - pending) / total) * 100}%` : "0%",
                          }}
                        />
                      </div>

                      {/* Items preview */}
                      <div className="space-y-1 mb-3 max-h-32 overflow-hidden">
                        {filteredItems.slice(0, 4).map((item) => (
                          <div
                            key={item.id}
                            className="flex items-center gap-2 text-sm"
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${item.is_completed ? "bg-green-400" : "bg-red-400"}`}
                            />
                            <span
                              className={`flex-1 ${item.is_completed ? "line-through text-gray-400" : "text-gray-700"}`}
                            >
                              {item.name_ko}
                            </span>
                            <span className="text-gray-400 text-xs">
                              ×{item.quantity}
                            </span>
                          </div>
                        ))}
                        {filteredItems.length > 4 && (
                          <p className="text-xs text-gray-400">
                            +{filteredItems.length - 4}개 더...
                          </p>
                        )}
                      </div>

                      {/* Total */}
                      <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                        <span className="font-bold text-kakao-brown">
                          ₩{order.total_amount.toLocaleString()}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            markPaid(order.id);
                          }}
                          className="text-xs bg-kakao-yellow text-kakao-brown font-bold px-3 py-1.5 rounded-xl hover:bg-kakao-yellow-dark"
                        >
                          결제 완료
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {/* Order Detail Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => { setSelectedOrder(null); setShowAddItem(false); }}
          />
          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col">
            {/* Modal header */}
            <div className="px-5 pt-5 pb-3 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-800">
                  {selectedOrder.restaurant_tables?.name}
                </h2>
                <p className="text-xs text-gray-400">
                  {new Date(selectedOrder.created_at).toLocaleString("ko-KR")}
                </p>
              </div>
              <button
                onClick={() => { setSelectedOrder(null); setShowAddItem(false); }}
                className="text-gray-400 text-2xl"
              >
                ×
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-3 space-y-2">
              {/* Kitchen items */}
              {selectedOrder.order_items.filter((i) => i.staff_type === "kitchen").length > 0 && (
                <div>
                  <p className="text-xs font-bold text-red-500 mb-2 flex items-center gap-1">
                    🍳 주방
                  </p>
                  {selectedOrder.order_items
                    .filter((i) => i.staff_type === "kitchen")
                    .map((item) => (
                      <div
                        key={item.id}
                        className={`flex items-center gap-3 p-3 rounded-xl mb-1 ${item.is_completed ? "bg-gray-50" : "bg-red-50"}`}
                      >
                        <button
                          onClick={() => toggleItem(selectedOrder.id, item.id, item.is_completed)}
                          className={`w-7 h-7 rounded-lg border-2 flex items-center justify-center text-sm font-bold transition-all ${item.is_completed ? "bg-green-500 border-green-500 text-white" : "border-gray-300 text-gray-300 hover:border-green-400"}`}
                        >
                          {item.is_completed ? "✓" : ""}
                        </button>
                        <div className="flex-1">
                          <p className={`text-sm font-medium ${item.is_completed ? "line-through text-gray-400" : "text-gray-800"}`}>
                            {item.name_ko}
                          </p>
                          <p className="text-xs text-gray-400">
                            {item.quantity}개 · ₩{(item.price * item.quantity).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    ))}
                </div>
              )}

              {/* Hall items */}
              {selectedOrder.order_items.filter((i) => i.staff_type === "hall").length > 0 && (
                <div>
                  <p className="text-xs font-bold text-blue-500 mb-2">
                    🍺 홀
                  </p>
                  {selectedOrder.order_items
                    .filter((i) => i.staff_type === "hall")
                    .map((item) => (
                      <div
                        key={item.id}
                        className={`flex items-center gap-3 p-3 rounded-xl mb-1 ${item.is_completed ? "bg-gray-50" : "bg-blue-50"}`}
                      >
                        <button
                          onClick={() => toggleItem(selectedOrder.id, item.id, item.is_completed)}
                          className={`w-7 h-7 rounded-lg border-2 flex items-center justify-center text-sm font-bold transition-all ${item.is_completed ? "bg-green-500 border-green-500 text-white" : "border-gray-300 text-gray-300 hover:border-green-400"}`}
                        >
                          {item.is_completed ? "✓" : ""}
                        </button>
                        <div className="flex-1">
                          <p className={`text-sm font-medium ${item.is_completed ? "line-through text-gray-400" : "text-gray-800"}`}>
                            {item.name_ko}
                          </p>
                          <p className="text-xs text-gray-400">
                            {item.quantity}개 · ₩{(item.price * item.quantity).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    ))}
                </div>
              )}

              {/* Manual add item */}
              {showAddItem ? (
                <div className="bg-yellow-50 border border-kakao-yellow rounded-xl p-3 space-y-2">
                  <p className="text-xs font-bold text-kakao-brown">메뉴 직접 추가</p>
                  <input
                    placeholder="메뉴명 (한국어)"
                    value={addItemForm.name_ko}
                    onChange={(e) => setAddItemForm({ ...addItemForm, name_ko: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-kakao-yellow"
                  />
                  <input
                    placeholder="메뉴명 (English)"
                    value={addItemForm.name_en}
                    onChange={(e) => setAddItemForm({ ...addItemForm, name_en: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-kakao-yellow"
                  />
                  <div className="flex gap-2">
                    <input
                      placeholder="가격"
                      type="number"
                      value={addItemForm.price}
                      onChange={(e) => setAddItemForm({ ...addItemForm, price: e.target.value })}
                      className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-kakao-yellow"
                    />
                    <input
                      placeholder="수량"
                      type="number"
                      min="1"
                      value={addItemForm.quantity}
                      onChange={(e) => setAddItemForm({ ...addItemForm, quantity: e.target.value })}
                      className="w-16 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-kakao-yellow"
                    />
                  </div>
                  <div className="flex gap-2">
                    {["kitchen", "hall"].map((t) => (
                      <button
                        key={t}
                        onClick={() => setAddItemForm({ ...addItemForm, staff_type: t })}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-all ${addItemForm.staff_type === t ? "bg-kakao-yellow border-kakao-yellow text-kakao-brown" : "border-gray-200 text-gray-500"}`}
                      >
                        {t === "kitchen" ? "🍳 주방" : "🍺 홀"}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowAddItem(false)}
                      className="flex-1 py-2 rounded-lg text-xs text-gray-500 border border-gray-200"
                    >
                      취소
                    </button>
                    <button
                      onClick={() => addManualItem(selectedOrder.id)}
                      className="flex-1 py-2 rounded-lg text-xs font-bold bg-kakao-yellow text-kakao-brown"
                    >
                      추가
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowAddItem(true)}
                  className="w-full border-2 border-dashed border-gray-200 rounded-xl py-3 text-sm text-gray-400 hover:border-kakao-yellow hover:text-kakao-brown transition-colors"
                >
                  + 메뉴 직접 추가
                </button>
              )}
            </div>

            {/* Modal footer */}
            <div className="px-5 py-4 border-t border-gray-100">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-gray-500">합계</span>
                <span className="font-bold text-lg text-kakao-brown">
                  ₩{selectedOrder.total_amount.toLocaleString()}
                </span>
              </div>
              <button
                onClick={() => markPaid(selectedOrder.id)}
                className="w-full bg-kakao-yellow text-kakao-brown font-bold py-3.5 rounded-2xl"
              >
                결제 완료 처리
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
