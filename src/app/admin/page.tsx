"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase, OrderItem, CustomerRequest, Table, MenuItem, Category } from "@/lib/supabase";

type ActiveOrder = {
  id: string;
  table_id: string;
  total_amount: number;
  created_at: string;
  status: string;
  order_items: OrderItem[];
  customer_requests: CustomerRequest[];
};

type TableWithOrder = Table & { activeOrder?: ActiveOrder };

export default function AdminDashboard() {
  const [tables, setTables] = useState<TableWithOrder[]>([]);
  const [requests, setRequests] = useState<CustomerRequest[]>([]);
  const [selected, setSelected] = useState<TableWithOrder | null>(null);
  const [restaurantId, setRestaurantId] = useState("");
  const [loading, setLoading] = useState(true);

  // Panel state
  const [categories, setCategories] = useState<Category[]>([]);
  const [menuItems, setMenuItems] = useState<(MenuItem & { is_sold_out?: boolean })[]>([]);
  const [selectedCat, setSelectedCat] = useState("all");
  const [addingItem, setAddingItem] = useState<string | null>(null); // item id being added

  const fetchAll = useCallback(async (rid: string) => {
    const [tablesRes, ordersRes, requestsRes] = await Promise.all([
      fetch(`/api/tables?restaurant_id=${rid}`),
      fetch(`/api/orders?status=active&restaurant_id=${rid}`),
      fetch(`/api/requests?restaurant_id=${rid}`),
    ]);
    const [tablesData, ordersData, requestsData] = await Promise.all([
      tablesRes.json(), ordersRes.json(), requestsRes.json(),
    ]);

    if (Array.isArray(tablesData) && Array.isArray(ordersData)) {
      const merged: TableWithOrder[] = tablesData.map((t: Table) => ({
        ...t,
        activeOrder: ordersData.find((o: ActiveOrder) => o.table_id === t.id),
      }));
      setTables(merged);
      // Keep selected in sync
      setSelected(prev => prev
        ? merged.find(t => t.id === prev.id) || null
        : null
      );
    }
    if (Array.isArray(requestsData)) setRequests(requestsData);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetch("/api/auth/me").then(r => r.json()).then(d => {
      if (d.id) {
        setRestaurantId(d.id);
        fetchAll(d.id);
        // Load menu
        Promise.all([
          fetch(`/api/categories?restaurant_id=${d.id}`).then(r => r.json()),
          fetch(`/api/menu?all=1&restaurant_id=${d.id}`).then(r => r.json()),
        ]).then(([cats, items]) => {
          if (Array.isArray(cats)) setCategories(cats);
          if (Array.isArray(items)) setMenuItems(items);
        });
      }
    });
  }, [fetchAll]);

  // Real-time
  useEffect(() => {
    if (!restaurantId) return;
    const sub = supabase
      .channel("admin-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => fetchAll(restaurantId))
      .on("postgres_changes", { event: "*", schema: "public", table: "order_items" }, () => fetchAll(restaurantId))
      .on("postgres_changes", { event: "*", schema: "public", table: "customer_requests" }, () => fetchAll(restaurantId))
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [restaurantId, fetchAll]);

  const toggleItem = async (orderId: string, itemId: string, current: boolean) => {
    await fetch(`/api/orders/${orderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ item_id: itemId, is_completed: !current }),
    });
    fetchAll(restaurantId);
  };

  const markPaid = async (orderId: string) => {
    if (!confirm("결제 완료 처리하시겠습니까?")) return;
    await fetch("/api/orders", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: orderId, status: "paid" }),
    });
    setSelected(null);
    fetchAll(restaurantId);
  };

  const completeRequest = async (id: string) => {
    await fetch("/api/requests", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, is_completed: true }),
    });
    fetchAll(restaurantId);
  };

  const addMenuToTable = async (table: TableWithOrder, item: MenuItem) => {
    setAddingItem(item.id);
    // If no active order, create one first
    if (!table.activeOrder) {
      await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          table_id: table.id,
          restaurant_id: restaurantId,
          items: [{ menu_item_id: item.id, name_ko: item.name_ko, name_en: item.name_en, price: item.price, quantity: 1, staff_type: item.staff_type }],
        }),
      });
    } else {
      await fetch(`/api/orders/${table.activeOrder.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          add_item: { menu_item_id: item.id, name_ko: item.name_ko, name_en: item.name_en, price: item.price, quantity: 1, staff_type: item.staff_type },
        }),
      });
    }
    setAddingItem(null);
    await fetchAll(restaurantId);
    // Re-select to show updated order
    setSelected(prev => prev?.id === table.id ? prev : prev);
  };

  // Kitchen + Hall queues from all tables
  const kitchenQueue = tables
    .filter(t => t.activeOrder)
    .flatMap(t => (t.activeOrder!.order_items || [])
      .filter(i => !i.is_completed && i.staff_type === "kitchen")
      .map(i => ({ ...i, table_name: t.name, order_id: t.activeOrder!.id })))
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  const hallQueue = tables
    .filter(t => t.activeOrder)
    .flatMap(t => (t.activeOrder!.order_items || [])
      .filter(i => !i.is_completed && i.staff_type === "hall")
      .map(i => ({ ...i, table_name: t.name, order_id: t.activeOrder!.id })))
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  const filteredMenu = selectedCat === "all"
    ? menuItems.filter(m => m.is_available && !m.is_sold_out)
    : menuItems.filter(m => m.category_id === selectedCat && m.is_available && !m.is_sold_out);

  if (loading) {
    return (
      <div className="sm:ml-56 flex items-center justify-center h-screen bg-gray-50 dark:bg-gray-950">
        <div className="text-4xl animate-spin text-kakao-yellow">⟳</div>
      </div>
    );
  }

  return (
    <div className="sm:ml-56 flex flex-col bg-gray-50 dark:bg-gray-950" style={{ height: "calc(100vh - 56px)" }}>
      {/* Top stats bar */}
      <div className="flex-shrink-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 py-2.5 flex items-center gap-4 text-sm">
        <span className="font-bold text-gray-700 dark:text-gray-200">대시보드</span>
        <span className="text-gray-400">|</span>
        <span className="text-gray-500 dark:text-gray-400">
          🪑 전체 <b className="text-gray-800 dark:text-white">{tables.length}</b>
        </span>
        <span className="text-gray-500 dark:text-gray-400">
          🟡 활성 <b className="text-kakao-brown dark:text-kakao-yellow">{tables.filter(t => t.activeOrder).length}</b>
        </span>
        {kitchenQueue.length + hallQueue.length > 0 && (
          <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full font-bold animate-pulse">
            {kitchenQueue.length + hallQueue.length} 대기
          </span>
        )}
        {requests.length > 0 && (
          <span className="bg-orange-400 text-white text-xs px-2 py-0.5 rounded-full font-bold">
            📣 {requests.length}
          </span>
        )}
      </div>

      {/* Main 3-column layout */}
      <div className="flex-1 overflow-hidden flex">

        {/* ── LEFT: All Tables ── */}
        <div className="flex-1 overflow-y-auto p-3">
          {tables.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-300 dark:text-gray-700">
              <span className="text-5xl mb-3">🪑</span>
              <p className="text-sm">테이블을 먼저 추가하세요</p>
              <a href="/admin/tables" className="mt-3 text-xs bg-kakao-yellow text-kakao-brown px-3 py-1.5 rounded-full font-bold">
                테이블 관리 →
              </a>
            </div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-2.5">
              {tables.map(table => {
                const order = table.activeOrder;
                const isSelected = selected?.id === table.id;
                const pending = order ? order.order_items.filter(i => !i.is_completed).length : 0;
                const total = order ? order.order_items.length : 0;
                const hasOrder = !!order;

                return (
                  <div
                    key={table.id}
                    onClick={() => setSelected(isSelected ? null : table)}
                    className={`rounded-2xl p-3.5 cursor-pointer transition-all border-2 ${
                      isSelected
                        ? "border-kakao-yellow shadow-lg scale-[1.02]"
                        : hasOrder
                        ? "border-kakao-yellow/40 bg-kakao-yellow/10 dark:bg-yellow-900/20 hover:border-kakao-yellow shadow-sm"
                        : "border-transparent bg-white dark:bg-gray-900 hover:border-gray-200 dark:hover:border-gray-700 shadow-sm"
                    }`}
                  >
                    {/* Header */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-sm font-black ${hasOrder ? "bg-kakao-yellow text-kakao-brown" : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400"}`}>
                          {table.number}
                        </div>
                        <div>
                          <p className={`text-sm font-bold ${hasOrder ? "text-gray-800 dark:text-white" : "text-gray-500 dark:text-gray-400"}`}>
                            {table.name}
                          </p>
                          <p className="text-xs text-gray-400">👤 {table.capacity}</p>
                        </div>
                      </div>
                      {hasOrder && pending > 0 && (
                        <span className="text-xs bg-red-500 text-white px-1.5 py-0.5 rounded-full font-bold">{pending}</span>
                      )}
                      {hasOrder && pending === 0 && (
                        <span className="text-xs bg-green-400 text-white px-1.5 py-0.5 rounded-full">✓</span>
                      )}
                    </div>

                    {hasOrder ? (
                      <>
                        {/* Progress bar */}
                        <div className="h-1 bg-kakao-yellow/20 rounded-full mb-2">
                          <div className="h-full bg-green-400 rounded-full transition-all"
                            style={{ width: total > 0 ? `${((total - pending) / total) * 100}%` : "0%" }} />
                        </div>
                        {/* Items preview */}
                        <div className="space-y-0.5 mb-2">
                          {order!.order_items.slice(0, 2).map(item => (
                            <div key={item.id} className="flex items-center gap-1.5 text-xs">
                              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${item.is_completed ? "bg-green-400" : item.staff_type === "kitchen" ? "bg-red-400" : "bg-blue-400"}`} />
                              <span className={`flex-1 truncate ${item.is_completed ? "line-through text-gray-400" : "text-gray-700 dark:text-gray-300"}`}>
                                {item.name_ko}
                              </span>
                              <span className="text-gray-400">×{item.quantity}</span>
                            </div>
                          ))}
                          {order!.order_items.length > 2 && (
                            <p className="text-xs text-gray-400">+{order!.order_items.length - 2}개 더</p>
                          )}
                        </div>
                        <div className="flex items-center justify-between pt-1.5 border-t border-kakao-yellow/20">
                          <span className="font-bold text-kakao-brown text-sm">₩{order!.total_amount.toLocaleString()}</span>
                          <button
                            onClick={e => { e.stopPropagation(); markPaid(order!.id); }}
                            className="text-xs bg-kakao-yellow text-kakao-brown font-bold px-2 py-1 rounded-lg"
                          >결제</button>
                        </div>
                      </>
                    ) : (
                      <p className="text-xs text-gray-400 dark:text-gray-600 text-center py-2">빈 테이블</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Mobile: selected table panel */}
          {selected && (
            <div className="mt-3 sm:hidden">
              <TablePanel
                table={selected} categories={categories} filteredMenu={filteredMenu}
                selectedCat={selectedCat} setSelectedCat={setSelectedCat}
                onAddMenu={addMenuToTable} addingItem={addingItem}
                onToggle={toggleItem} onPay={markPaid} onClose={() => setSelected(null)}
              />
            </div>
          )}
        </div>

        {/* ── MIDDLE: Kitchen queue ── */}
        <div className="hidden sm:flex flex-col w-52 border-l border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
          <div className="px-3 py-2.5 border-b border-gray-200 dark:border-gray-800 bg-red-50 dark:bg-red-950/40 flex items-center justify-between flex-shrink-0">
            <span className="font-bold text-sm text-red-600 dark:text-red-400">🍳 주방</span>
            {kitchenQueue.length > 0 && <span className="text-xs bg-red-500 text-white px-1.5 py-0.5 rounded-full font-bold">{kitchenQueue.length}</span>}
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
            {kitchenQueue.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-gray-300 dark:text-gray-700">
                <span className="text-3xl mb-1">✓</span><p className="text-xs">완료</p>
              </div>
            ) : kitchenQueue.map((item, i) => (
              <div key={item.id} className="bg-red-50 dark:bg-red-950/30 rounded-xl p-2.5 flex gap-2">
                <span className="text-xs font-black text-gray-300 dark:text-gray-600 w-4 flex-shrink-0 mt-0.5">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-red-400 mb-0.5">{item.table_name}</p>
                  <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 leading-tight">{item.name_ko}</p>
                  <p className="text-xs text-gray-400 mt-0.5">×{item.quantity} · {new Date(item.created_at).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}</p>
                </div>
                <button onClick={() => toggleItem(item.order_id, item.id, false)}
                  className="flex-shrink-0 w-8 h-8 rounded-lg bg-red-300 hover:bg-green-500 text-white flex items-center justify-center font-bold transition-colors">✓</button>
              </div>
            ))}
          </div>
        </div>

        {/* ── RIGHT: Hall queue + Requests ── */}
        <div className="hidden sm:flex flex-col w-52 border-l border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
          <div className="px-3 py-2.5 border-b border-gray-200 dark:border-gray-800 bg-blue-50 dark:bg-blue-950/40 flex items-center justify-between flex-shrink-0">
            <span className="font-bold text-sm text-blue-600 dark:text-blue-400">🍺 홀</span>
            {hallQueue.length > 0 && <span className="text-xs bg-blue-500 text-white px-1.5 py-0.5 rounded-full font-bold">{hallQueue.length}</span>}
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
            {hallQueue.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-24 text-gray-300 dark:text-gray-700">
                <span className="text-3xl mb-1">✓</span><p className="text-xs">완료</p>
              </div>
            ) : hallQueue.map((item, i) => (
              <div key={item.id} className="bg-blue-50 dark:bg-blue-950/30 rounded-xl p-2.5 flex gap-2">
                <span className="text-xs font-black text-gray-300 dark:text-gray-600 w-4 flex-shrink-0 mt-0.5">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-blue-400 mb-0.5">{item.table_name}</p>
                  <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 leading-tight">{item.name_ko}</p>
                  <p className="text-xs text-gray-400 mt-0.5">×{item.quantity} · {new Date(item.created_at).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}</p>
                </div>
                <button onClick={() => toggleItem(item.order_id, item.id, false)}
                  className="flex-shrink-0 w-8 h-8 rounded-lg bg-blue-300 hover:bg-green-500 text-white flex items-center justify-center font-bold transition-colors">✓</button>
              </div>
            ))}
          </div>
          {/* Requests */}
          {requests.length > 0 && (
            <div className="border-t border-gray-200 dark:border-gray-800 p-2 space-y-1.5 max-h-44 overflow-y-auto flex-shrink-0">
              <p className="text-xs font-bold text-orange-500 px-1">📣 요청</p>
              {requests.map(req => (
                <div key={req.id} className="bg-orange-50 dark:bg-orange-950/30 rounded-xl p-2 flex gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-orange-400">{req.restaurant_tables?.name}</p>
                    <p className="text-xs text-gray-700 dark:text-gray-300 mt-0.5 break-words">{req.message}</p>
                  </div>
                  <button onClick={() => completeRequest(req.id)}
                    className="flex-shrink-0 w-7 h-7 bg-green-500 text-white rounded-lg flex items-center justify-center text-xs font-bold">✓</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Desktop: Table detail panel (slide in from right over hall queue) */}
      {selected && (
        <div className="hidden sm:block fixed right-0 top-14 bottom-0 z-40 w-80 shadow-2xl border-l border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-y-auto">
          <TablePanel
            table={selected} categories={categories} filteredMenu={filteredMenu}
            selectedCat={selectedCat} setSelectedCat={setSelectedCat}
            onAddMenu={addMenuToTable} addingItem={addingItem}
            onToggle={toggleItem} onPay={markPaid} onClose={() => setSelected(null)}
          />
        </div>
      )}
    </div>
  );
}

// ── Table Detail Panel ──
function TablePanel({
  table, categories, filteredMenu, selectedCat, setSelectedCat,
  onAddMenu, addingItem, onToggle, onPay, onClose,
}: {
  table: TableWithOrder;
  categories: Category[];
  filteredMenu: (MenuItem & { is_sold_out?: boolean })[];
  selectedCat: string;
  setSelectedCat: (v: string) => void;
  onAddMenu: (table: TableWithOrder, item: MenuItem) => void;
  addingItem: string | null;
  onToggle: (orderId: string, itemId: string, current: boolean) => void;
  onPay: (orderId: string) => void;
  onClose: () => void;
}) {
  const order = table.activeOrder;
  const kitchenItems = order?.order_items.filter(i => i.staff_type === "kitchen") || [];
  const hallItems = order?.order_items.filter(i => i.staff_type === "hall") || [];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between flex-shrink-0 bg-kakao-yellow/10 dark:bg-yellow-900/20">
        <div>
          <h2 className="font-bold text-gray-800 dark:text-white text-base">{table.name}</h2>
          <p className="text-xs text-gray-400">👤 {table.capacity}명</p>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Current order */}
        {order && (order.order_items.length > 0) && (
          <div className="px-4 pt-3 pb-2">
            <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-2">현재 주문</p>
            {kitchenItems.length > 0 && (
              <div className="mb-2">
                <p className="text-xs font-bold text-red-400 mb-1">🍳 주방</p>
                {kitchenItems.map(item => (
                  <div key={item.id} className={`flex items-center gap-2 p-2 rounded-xl mb-1 ${item.is_completed ? "bg-gray-50 dark:bg-gray-800/50" : "bg-red-50 dark:bg-red-950/30"}`}>
                    <button onClick={() => onToggle(order.id, item.id, item.is_completed)}
                      className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center text-xs font-bold flex-shrink-0 ${item.is_completed ? "bg-green-500 border-green-500 text-white" : "border-gray-300 dark:border-gray-600"}`}>
                      {item.is_completed ? "✓" : ""}
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium ${item.is_completed ? "line-through text-gray-400" : "text-gray-800 dark:text-gray-100"}`}>{item.name_ko}</p>
                      <p className="text-xs text-gray-400">×{item.quantity} · ₩{(item.price * item.quantity).toLocaleString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {hallItems.length > 0 && (
              <div className="mb-2">
                <p className="text-xs font-bold text-blue-400 mb-1">🍺 홀</p>
                {hallItems.map(item => (
                  <div key={item.id} className={`flex items-center gap-2 p-2 rounded-xl mb-1 ${item.is_completed ? "bg-gray-50 dark:bg-gray-800/50" : "bg-blue-50 dark:bg-blue-950/30"}`}>
                    <button onClick={() => onToggle(order.id, item.id, item.is_completed)}
                      className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center text-xs font-bold flex-shrink-0 ${item.is_completed ? "bg-green-500 border-green-500 text-white" : "border-gray-300 dark:border-gray-600"}`}>
                      {item.is_completed ? "✓" : ""}
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium ${item.is_completed ? "line-through text-gray-400" : "text-gray-800 dark:text-gray-100"}`}>{item.name_ko}</p>
                      <p className="text-xs text-gray-400">×{item.quantity} · ₩{(item.price * item.quantity).toLocaleString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Divider */}
        <div className="px-4 py-2">
          <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wide">메뉴 추가</p>
        </div>

        {/* Category tabs */}
        <div className="flex overflow-x-auto scrollbar-hide px-4 gap-1.5 pb-2">
          <button onClick={() => setSelectedCat("all")}
            className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium ${selectedCat === "all" ? "bg-kakao-yellow text-kakao-brown" : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400"}`}>
            전체
          </button>
          {categories.map(cat => (
            <button key={cat.id} onClick={() => setSelectedCat(cat.id)}
              className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium ${selectedCat === cat.id ? "bg-kakao-yellow text-kakao-brown" : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400"}`}>
              {cat.name_ko}
            </button>
          ))}
        </div>

        {/* Menu items */}
        <div className="px-4 pb-4 space-y-1.5">
          {filteredMenu.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-4">메뉴가 없습니다</p>
          ) : filteredMenu.map(item => (
            <div key={item.id} className="flex items-center gap-3 bg-gray-50 dark:bg-gray-800 rounded-xl px-3 py-2.5">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">{item.name_ko}</p>
                <p className="text-xs font-bold text-kakao-brown">₩{item.price.toLocaleString()}</p>
              </div>
              <button
                onClick={() => onAddMenu(table, item)}
                disabled={addingItem === item.id}
                className="flex-shrink-0 w-8 h-8 rounded-xl bg-kakao-yellow text-kakao-brown font-bold text-lg flex items-center justify-center disabled:opacity-50 hover:bg-kakao-yellow-dark transition-colors"
              >
                {addingItem === item.id ? "…" : "+"}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Footer - total + pay */}
      {order && (
        <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-800 flex-shrink-0 bg-white dark:bg-gray-900">
          <div className="flex justify-between items-center mb-2.5">
            <span className="text-sm text-gray-500 dark:text-gray-400">합계</span>
            <span className="font-black text-lg text-kakao-brown">₩{order.total_amount.toLocaleString()}</span>
          </div>
          <button onClick={() => onPay(order.id)}
            className="w-full bg-kakao-yellow text-kakao-brown font-bold py-3 rounded-2xl text-sm">
            💳 결제 완료
          </button>
        </div>
      )}
    </div>
  );
}
