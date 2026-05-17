"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase, Order, OrderItem, CustomerRequest, Table, MenuItem } from "@/lib/supabase";

type OrderWithDetails = Order & {
  order_items: OrderItem[];
  customer_requests: CustomerRequest[];
  restaurant_tables: Table;
};

export default function AdminDashboard() {
  const [orders, setOrders] = useState<OrderWithDetails[]>([]);
  const [requests, setRequests] = useState<CustomerRequest[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<OrderWithDetails | null>(null);
  const [showAddItem, setShowAddItem] = useState(false);
  const [addItemForm, setAddItemForm] = useState({ name_ko: "", name_en: "", price: "", quantity: "1", staff_type: "kitchen" });
  const [menuSearch, setMenuSearch] = useState("");
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    const [ordersRes, requestsRes] = await Promise.all([
      fetch("/api/orders?status=active"),
      fetch("/api/requests"),
    ]);
    const [ordersData, requestsData] = await Promise.all([ordersRes.json(), requestsRes.json()]);
    if (Array.isArray(ordersData)) {
      setOrders(ordersData);
      // Keep selectedOrder in sync
      setSelectedOrder(prev => prev ? ordersData.find((o: OrderWithDetails) => o.id === prev.id) || null : null);
    }
    if (Array.isArray(requestsData)) setRequests(requestsData);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
    fetch("/api/menu?all=1").then(r => r.json()).then(d => { if (Array.isArray(d)) setMenuItems(d); });

    const sub = supabase
      .channel("admin-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, fetchData)
      .on("postgres_changes", { event: "*", schema: "public", table: "order_items" }, fetchData)
      .on("postgres_changes", { event: "*", schema: "public", table: "customer_requests" }, fetchData)
      .subscribe();

    return () => { supabase.removeChannel(sub); };
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

  const addManualItem = async (orderId: string, item?: MenuItem) => {
    const payload = item
      ? { name_ko: item.name_ko, name_en: item.name_en, price: item.price, quantity: 1, staff_type: item.staff_type, menu_item_id: item.id }
      : { name_ko: addItemForm.name_ko, name_en: addItemForm.name_en || addItemForm.name_ko, price: parseInt(addItemForm.price), quantity: parseInt(addItemForm.quantity), staff_type: addItemForm.staff_type };

    await fetch(`/api/orders/${orderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ add_item: payload }),
    });
    setAddItemForm({ name_ko: "", name_en: "", price: "", quantity: "1", staff_type: "kitchen" });
    setMenuSearch("");
    fetchData();
  };

  // All pending kitchen items across tables
  const kitchenQueue = orders
    .flatMap((o) => o.order_items.filter((i) => !i.is_completed && i.staff_type === "kitchen")
      .map((i) => ({ ...i, table_name: o.restaurant_tables?.name, order_id: o.id })))
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  // All pending hall items across tables
  const hallQueue = orders
    .flatMap((o) => o.order_items.filter((i) => !i.is_completed && i.staff_type === "hall")
      .map((i) => ({ ...i, table_name: o.restaurant_tables?.name, order_id: o.id })))
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  const pendingTotal = kitchenQueue.length + hallQueue.length;
  const filteredMenu = menuItems.filter(m => m.name_ko.includes(menuSearch) || m.name_en.toLowerCase().includes(menuSearch.toLowerCase()));

  const QueuePanel = ({ items, type }: { items: typeof kitchenQueue; type: "kitchen" | "hall" }) => (
    <div className={`flex flex-col h-full ${type === "kitchen" ? "border-l border-gray-200 dark:border-gray-800" : "border-l border-gray-200 dark:border-gray-800"}`}>
      {/* Panel header */}
      <div className={`px-3 py-2.5 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between flex-shrink-0 ${type === "kitchen" ? "bg-red-50 dark:bg-red-950/40" : "bg-blue-50 dark:bg-blue-950/40"}`}>
        <span className={`font-bold text-sm ${type === "kitchen" ? "text-red-600 dark:text-red-400" : "text-blue-600 dark:text-blue-400"}`}>
          {type === "kitchen" ? "🍳 주방" : "🍺 홀"}
        </span>
        {items.length > 0 && (
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${type === "kitchen" ? "bg-red-500 text-white" : "bg-blue-500 text-white"}`}>
            {items.length}
          </span>
        )}
      </div>
      {/* Queue items */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-300 dark:text-gray-700 py-8">
            <span className="text-3xl mb-1">✓</span>
            <p className="text-xs">완료</p>
          </div>
        ) : items.map((item, idx) => (
          <div key={item.id} className="bg-white dark:bg-gray-800 rounded-xl p-2.5 flex items-start gap-2 shadow-sm">
            <span className="text-xs font-black text-gray-300 dark:text-gray-600 w-4 flex-shrink-0 mt-0.5">{idx + 1}</span>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-gray-500 dark:text-gray-400 mb-0.5">{item.table_name}</p>
              <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 leading-tight">{item.name_ko}</p>
              <p className="text-xs text-gray-400 mt-0.5">
                ×{item.quantity} · {new Date(item.created_at).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
            <button
              onClick={() => toggleItem(item.order_id, item.id, false)}
              className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center font-bold text-white transition-all ${type === "kitchen" ? "bg-red-400 hover:bg-green-500" : "bg-blue-400 hover:bg-green-500"}`}
            >
              ✓
            </button>
          </div>
        ))}
      </div>
      {/* Requests in hall panel */}
      {type === "hall" && requests.length > 0 && (
        <div className="border-t border-gray-200 dark:border-gray-800 p-2 space-y-1.5 flex-shrink-0 max-h-48 overflow-y-auto">
          <p className="text-xs font-bold text-orange-500 px-1">📣 요청사항</p>
          {requests.map((req) => (
            <div key={req.id} className="bg-orange-50 dark:bg-orange-950/40 rounded-xl p-2.5 flex items-start gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-orange-500">{req.restaurant_tables?.name}</p>
                <p className="text-xs text-gray-700 dark:text-gray-300 mt-0.5">{req.message}</p>
              </div>
              <button
                onClick={() => completeRequest(req.id)}
                className="flex-shrink-0 w-7 h-7 bg-green-500 text-white rounded-lg flex items-center justify-center text-xs font-bold"
              >
                ✓
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  if (loading) {
    return (
      <div className="sm:ml-56 flex items-center justify-center h-screen">
        <div className="text-4xl animate-spin">⟳</div>
      </div>
    );
  }

  return (
    <div className="sm:ml-56 flex flex-col h-screen bg-gray-50 dark:bg-gray-950">
      {/* Top bar */}
      <div className="flex-shrink-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 py-2.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h1 className="font-bold text-gray-800 dark:text-white text-base">대시보드</h1>
          {pendingTotal > 0 && (
            <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full font-bold animate-pulse">
              {pendingTotal} 대기
            </span>
          )}
          {requests.length > 0 && (
            <span className="bg-orange-400 text-white text-xs px-2 py-0.5 rounded-full font-bold">
              📣 {requests.length}
            </span>
          )}
        </div>
        <p className="text-xs text-gray-400 dark:text-gray-500 hidden sm:block">
          테이블 클릭 → 주문 상세
        </p>
      </div>

      {/* 3-panel layout */}
      <div className="flex-1 overflow-hidden grid grid-cols-1 sm:grid-cols-[1fr_220px_220px]">

        {/* LEFT: Table Cards */}
        <div className="overflow-y-auto p-3 space-y-0">
          {orders.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-300 dark:text-gray-700">
              <span className="text-5xl mb-2">🪑</span>
              <p className="text-sm">활성 주문 없음</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-2.5">
              {orders.map((order) => {
                const pending = order.order_items.filter((i) => !i.is_completed).length;
                const total = order.order_items.length;
                const isSelected = selectedOrder?.id === order.id;
                return (
                  <div
                    key={order.id}
                    onClick={() => setSelectedOrder(isSelected ? null : order)}
                    className={`bg-white dark:bg-gray-900 rounded-2xl p-3.5 shadow-sm cursor-pointer transition-all border-2 ${isSelected ? "border-kakao-yellow shadow-md" : "border-transparent hover:border-gray-200 dark:hover:border-gray-700"}`}
                  >
                    {/* Table name + status */}
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h3 className="font-bold text-gray-800 dark:text-white text-sm">
                          {order.restaurant_tables?.name}
                        </h3>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {new Date(order.created_at).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                      <div className="text-right">
                        {pending > 0 ? (
                          <span className="text-xs bg-red-500 text-white px-1.5 py-0.5 rounded-full font-bold">{pending}</span>
                        ) : (
                          <span className="text-xs bg-green-100 text-green-600 dark:bg-green-900/40 dark:text-green-400 px-1.5 py-0.5 rounded-full">✓</span>
                        )}
                      </div>
                    </div>

                    {/* Progress */}
                    <div className="h-1 bg-gray-100 dark:bg-gray-800 rounded-full mb-2">
                      <div
                        className="h-full bg-green-400 rounded-full transition-all"
                        style={{ width: total > 0 ? `${((total - pending) / total) * 100}%` : "0%" }}
                      />
                    </div>

                    {/* Items preview */}
                    <div className="space-y-0.5 mb-2.5">
                      {order.order_items.slice(0, 3).map((item) => (
                        <div key={item.id} className="flex items-center gap-1.5 text-xs">
                          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${item.is_completed ? "bg-green-400" : item.staff_type === "kitchen" ? "bg-red-400" : "bg-blue-400"}`} />
                          <span className={`flex-1 truncate ${item.is_completed ? "line-through text-gray-400" : "text-gray-700 dark:text-gray-300"}`}>
                            {item.name_ko}
                          </span>
                          <span className="text-gray-400">×{item.quantity}</span>
                        </div>
                      ))}
                      {order.order_items.length > 3 && (
                        <p className="text-xs text-gray-400">+{order.order_items.length - 3}개</p>
                      )}
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-kakao-brown text-sm">
                        ₩{order.total_amount.toLocaleString()}
                      </span>
                      <button
                        onClick={(e) => { e.stopPropagation(); markPaid(order.id); }}
                        className="text-xs bg-kakao-yellow text-kakao-brown font-bold px-2.5 py-1 rounded-lg hover:bg-kakao-yellow-dark"
                      >
                        결제
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Selected Order Detail (shown below cards on mobile, or inline) */}
          {selectedOrder && (
            <div className={`mt-3 bg-white dark:bg-gray-900 rounded-2xl shadow-sm border-2 border-kakao-yellow sm:hidden`}>
              <OrderDetail
                order={selectedOrder}
                onClose={() => setSelectedOrder(null)}
                onToggle={toggleItem}
                onPay={markPaid}
                onAddItem={addManualItem}
                menuItems={filteredMenu}
                menuSearch={menuSearch}
                setMenuSearch={setMenuSearch}
                showAddItem={showAddItem}
                setShowAddItem={setShowAddItem}
                addItemForm={addItemForm}
                setAddItemForm={setAddItemForm}
              />
            </div>
          )}
        </div>

        {/* MIDDLE: Kitchen Queue */}
        <QueuePanel items={kitchenQueue} type="kitchen" />

        {/* RIGHT: Hall Queue + Requests */}
        <QueuePanel items={hallQueue} type="hall" />
      </div>

      {/* Order Detail Sidebar (desktop) */}
      {selectedOrder && (
        <div className="hidden sm:block fixed right-0 top-14 bottom-0 w-80 bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-800 z-30 overflow-y-auto shadow-xl">
          <OrderDetail
            order={selectedOrder}
            onClose={() => setSelectedOrder(null)}
            onToggle={toggleItem}
            onPay={markPaid}
            onAddItem={addManualItem}
            menuItems={filteredMenu}
            menuSearch={menuSearch}
            setMenuSearch={setMenuSearch}
            showAddItem={showAddItem}
            setShowAddItem={setShowAddItem}
            addItemForm={addItemForm}
            setAddItemForm={setAddItemForm}
          />
        </div>
      )}
    </div>
  );
}

function OrderDetail({
  order, onClose, onToggle, onPay, onAddItem,
  menuItems, menuSearch, setMenuSearch,
  showAddItem, setShowAddItem, addItemForm, setAddItemForm,
}: {
  order: {
    id: string; total_amount: number; created_at: string;
    restaurant_tables?: { name: string };
    order_items: OrderItem[];
  };
  onClose: () => void;
  onToggle: (orderId: string, itemId: string, current: boolean) => void;
  onPay: (orderId: string) => void;
  onAddItem: (orderId: string, item?: MenuItem) => void;
  menuItems: MenuItem[];
  menuSearch: string;
  setMenuSearch: (v: string) => void;
  showAddItem: boolean;
  setShowAddItem: (v: boolean) => void;
  addItemForm: { name_ko: string; name_en: string; price: string; quantity: string; staff_type: string };
  setAddItemForm: (v: typeof addItemForm) => void;
}) {
  const kitchenItems = order.order_items.filter((i) => i.staff_type === "kitchen");
  const hallItems = order.order_items.filter((i) => i.staff_type === "hall");

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between flex-shrink-0">
        <div>
          <h2 className="font-bold text-gray-800 dark:text-white">{order.restaurant_tables?.name}</h2>
          <p className="text-xs text-gray-400">{new Date(order.created_at).toLocaleString("ko-KR")}</p>
        </div>
        <button onClick={onClose} className="text-gray-400 text-xl leading-none">×</button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {/* Kitchen section */}
        {kitchenItems.length > 0 && (
          <div>
            <p className="text-xs font-bold text-red-500 mb-1.5">🍳 주방</p>
            {kitchenItems.map((item) => (
              <div key={item.id} className={`flex items-center gap-2.5 p-2.5 rounded-xl mb-1.5 ${item.is_completed ? "bg-gray-50 dark:bg-gray-800/50" : "bg-red-50 dark:bg-red-950/30"}`}>
                <button
                  onClick={() => onToggle(order.id, item.id, item.is_completed)}
                  className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center text-xs font-bold flex-shrink-0 transition-all ${item.is_completed ? "bg-green-500 border-green-500 text-white" : "border-gray-300 dark:border-gray-600"}`}
                >
                  {item.is_completed ? "✓" : ""}
                </button>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${item.is_completed ? "line-through text-gray-400" : "text-gray-800 dark:text-gray-100"}`}>
                    {item.name_ko}
                  </p>
                  <p className="text-xs text-gray-400">×{item.quantity} · ₩{(item.price * item.quantity).toLocaleString()}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Hall section */}
        {hallItems.length > 0 && (
          <div>
            <p className="text-xs font-bold text-blue-500 mb-1.5">🍺 홀</p>
            {hallItems.map((item) => (
              <div key={item.id} className={`flex items-center gap-2.5 p-2.5 rounded-xl mb-1.5 ${item.is_completed ? "bg-gray-50 dark:bg-gray-800/50" : "bg-blue-50 dark:bg-blue-950/30"}`}>
                <button
                  onClick={() => onToggle(order.id, item.id, item.is_completed)}
                  className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center text-xs font-bold flex-shrink-0 transition-all ${item.is_completed ? "bg-green-500 border-green-500 text-white" : "border-gray-300 dark:border-gray-600"}`}
                >
                  {item.is_completed ? "✓" : ""}
                </button>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${item.is_completed ? "line-through text-gray-400" : "text-gray-800 dark:text-gray-100"}`}>
                    {item.name_ko}
                  </p>
                  <p className="text-xs text-gray-400">×{item.quantity} · ₩{(item.price * item.quantity).toLocaleString()}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add item section */}
        {showAddItem ? (
          <div className="bg-yellow-50 dark:bg-yellow-950/30 border border-kakao-yellow rounded-xl p-3 space-y-2">
            <p className="text-xs font-bold text-kakao-brown">메뉴 추가</p>
            {/* Menu search */}
            <input
              placeholder="메뉴 검색..."
              value={menuSearch}
              onChange={(e) => setMenuSearch(e.target.value)}
              className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-kakao-yellow dark:bg-gray-800 dark:text-white"
            />
            {menuSearch && (
              <div className="max-h-32 overflow-y-auto space-y-1">
                {menuItems.slice(0, 8).map((m) => (
                  <button
                    key={m.id}
                    onClick={() => { onAddItem(order.id, m); }}
                    className="w-full text-left px-2.5 py-1.5 bg-white dark:bg-gray-800 rounded-lg text-xs flex justify-between hover:bg-kakao-yellow hover:text-kakao-brown transition-colors"
                  >
                    <span>{m.name_ko}</span>
                    <span className="text-gray-400">₩{m.price.toLocaleString()}</span>
                  </button>
                ))}
              </div>
            )}
            {/* Manual form */}
            <div className="border-t border-kakao-yellow/30 pt-2 space-y-1.5">
              <input placeholder="직접 입력 (한국어)" value={addItemForm.name_ko}
                onChange={(e) => setAddItemForm({ ...addItemForm, name_ko: e.target.value })}
                className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-2.5 py-1.5 text-xs dark:bg-gray-800 dark:text-white focus:outline-none" />
              <div className="flex gap-1.5">
                <input placeholder="가격" type="number" value={addItemForm.price}
                  onChange={(e) => setAddItemForm({ ...addItemForm, price: e.target.value })}
                  className="flex-1 border border-gray-200 dark:border-gray-700 rounded-lg px-2.5 py-1.5 text-xs dark:bg-gray-800 dark:text-white focus:outline-none" />
                <input placeholder="수량" type="number" min="1" value={addItemForm.quantity}
                  onChange={(e) => setAddItemForm({ ...addItemForm, quantity: e.target.value })}
                  className="w-14 border border-gray-200 dark:border-gray-700 rounded-lg px-2.5 py-1.5 text-xs dark:bg-gray-800 dark:text-white focus:outline-none" />
              </div>
              <div className="flex gap-1.5">
                {["kitchen", "hall"].map((t) => (
                  <button key={t}
                    onClick={() => setAddItemForm({ ...addItemForm, staff_type: t })}
                    className={`flex-1 py-1 rounded-lg text-xs font-bold border transition-all ${addItemForm.staff_type === t ? "bg-kakao-yellow border-kakao-yellow text-kakao-brown" : "border-gray-200 dark:border-gray-700 text-gray-500"}`}>
                    {t === "kitchen" ? "🍳 주방" : "🍺 홀"}
                  </button>
                ))}
              </div>
              <div className="flex gap-1.5">
                <button onClick={() => setShowAddItem(false)}
                  className="flex-1 py-1.5 border border-gray-200 dark:border-gray-700 rounded-lg text-xs text-gray-500">취소</button>
                <button onClick={() => { if (addItemForm.name_ko && addItemForm.price) onAddItem(order.id); }}
                  className="flex-1 py-1.5 bg-kakao-yellow text-kakao-brown font-bold rounded-lg text-xs">추가</button>
              </div>
            </div>
          </div>
        ) : (
          <button onClick={() => setShowAddItem(true)}
            className="w-full border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl py-2.5 text-sm text-gray-400 hover:border-kakao-yellow hover:text-kakao-brown transition-colors">
            + 메뉴 추가
          </button>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-800 flex-shrink-0">
        <div className="flex justify-between mb-2.5">
          <span className="text-sm text-gray-500 dark:text-gray-400">합계</span>
          <span className="font-bold text-kakao-brown">₩{order.total_amount.toLocaleString()}</span>
        </div>
        <button onClick={() => onPay(order.id)}
          className="w-full bg-kakao-yellow text-kakao-brown font-bold py-3 rounded-2xl text-sm">
          결제 완료
        </button>
      </div>
    </div>
  );
}
