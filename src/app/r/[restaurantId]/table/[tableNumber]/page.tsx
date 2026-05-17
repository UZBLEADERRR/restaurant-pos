"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase, Category, MenuItem } from "@/lib/supabase";
import Image from "next/image";

type Lang = "ko" | "en";
type CartItem = {
  menu_item_id: string; name_ko: string; name_en: string;
  price: number; quantity: number; staff_type: "kitchen" | "hall";
};
type TableInfo = { id: string; number: number; name: string };
type OrderStatus = { pending: number; completed: number; total: number };

const t = {
  ko: {
    cart: "장바구니", order: "주문하기", request: "요청", requestPlaceholder: "예: 수저 가져다 주세요",
    send: "보내기", total: "합계", empty: "장바구니가 비어있습니다", orderedMsg: "주문 완료!",
    requestSent: "요청 전송됨", add: "담기", close: "닫기", requestTitle: "직원 요청",
    preparing: "준비중", ready: "완료", myOrder: "내 주문",
    won: "₩", all: "전체", soldOut: "품절",
  },
  en: {
    cart: "Cart", order: "Place Order", request: "Request", requestPlaceholder: "e.g. Please bring spoons",
    send: "Send", total: "Total", empty: "Cart is empty", orderedMsg: "Order placed!",
    requestSent: "Request sent!", add: "Add", close: "Close", requestTitle: "Staff Request",
    preparing: "Preparing", ready: "Ready", myOrder: "My Order",
    won: "₩", all: "All", soldOut: "Sold Out",
  },
};

const quickRequests = {
  ko: ["수저 주세요", "냅킨 주세요", "물 주세요", "포크 주세요", "직원 불러주세요"],
  en: ["Chopsticks please", "Napkin please", "Water please", "Fork please", "Call staff"],
};

export default function CustomerPage({
  params,
}: {
  params: { restaurantId: string; tableNumber: string };
}) {
  const { restaurantId, tableNumber } = params;
  const [lang, setLang] = useState<Lang>("ko");
  const [dark, setDark] = useState(false);
  const [table, setTable] = useState<TableInfo | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [menuItems, setMenuItems] = useState<(MenuItem & { is_sold_out?: boolean })[]>([]);
  const [selectedCat, setSelectedCat] = useState("all");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCart, setShowCart] = useState(false);
  const [showRequest, setShowRequest] = useState(false);
  const [showMyOrder, setShowMyOrder] = useState(false);
  const [requestMsg, setRequestMsg] = useState("");
  const [orderId, setOrderId] = useState<string | null>(null);
  const [orderStatus, setOrderStatus] = useState<OrderStatus>({ pending: 0, completed: 0, total: 0 });
  const [toast, setToast] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const tr = t[lang];

  // Dark mode from system or localStorage
  useEffect(() => {
    const saved = localStorage.getItem("theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const isDark = saved ? saved === "dark" : prefersDark;
    setDark(isDark);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("theme", dark ? "dark" : "light");
  }, [dark]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const loadOrderStatus = useCallback(async (tid: string) => {
    const { data: orders } = await supabase
      .from("orders")
      .select("id, total_amount, order_items(*)")
      .eq("table_id", tid)
      .eq("restaurant_id", restaurantId)
      .eq("status", "active")
      .single();

    if (orders) {
      setOrderId(orders.id);
      const items = (orders.order_items as { is_completed: boolean }[]) || [];
      const pending = items.filter((i) => !i.is_completed).length;
      const completed = items.filter((i) => i.is_completed).length;
      setOrderStatus({ pending, completed, total: orders.total_amount });
    }
  }, [restaurantId]);

  useEffect(() => {
    const load = async () => {
      const { data: tableData } = await supabase
        .from("restaurant_tables")
        .select("id, number, name")
        .eq("number", tableNumber)
        .eq("restaurant_id", restaurantId)
        .single();

      if (tableData) {
        setTable(tableData);
        loadOrderStatus(tableData.id);
      }

      const { data: cats } = await supabase
        .from("categories")
        .select("*")
        .eq("is_active", true)
        .eq("restaurant_id", restaurantId)
        .order("sort_order");
      if (cats) setCategories(cats);

      const { data: items } = await supabase
        .from("menu_items")
        .select("*, categories(*)")
        .eq("is_available", true)
        .eq("restaurant_id", restaurantId)
        .order("sort_order");
      if (items) setMenuItems(items);
    };
    load();
  }, [restaurantId, tableNumber, loadOrderStatus]);

  // Poll order status every 8 seconds
  useEffect(() => {
    if (!table) return;
    const interval = setInterval(() => loadOrderStatus(table.id), 8000);
    return () => clearInterval(interval);
  }, [table, loadOrderStatus]);

  const filtered = selectedCat === "all" ? menuItems : menuItems.filter((m) => m.category_id === selectedCat);
  const totalCount = cart.reduce((s, c) => s + c.quantity, 0);
  const totalPrice = cart.reduce((s, c) => s + c.price * c.quantity, 0);

  const addToCart = (item: typeof menuItems[0]) => {
    if (item.is_sold_out) return;
    setCart((prev) => {
      const ex = prev.find((c) => c.menu_item_id === item.id);
      if (ex) return prev.map((c) => c.menu_item_id === item.id ? { ...c, quantity: c.quantity + 1 } : c);
      return [...prev, { menu_item_id: item.id, name_ko: item.name_ko, name_en: item.name_en, price: item.price, quantity: 1, staff_type: item.staff_type }];
    });
  };

  const changeQty = (id: string, delta: number) =>
    setCart((prev) => prev.map((c) => c.menu_item_id === id ? { ...c, quantity: c.quantity + delta } : c).filter((c) => c.quantity > 0));

  const placeOrder = async () => {
    if (!table || cart.length === 0) return;
    setLoading(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ table_id: table.id, items: cart, restaurant_id: restaurantId }),
      });
      const data = await res.json();
      if (data.order_id) {
        setOrderId(data.order_id);
        setCart([]);
        setShowCart(false);
        showToast(tr.orderedMsg);
        loadOrderStatus(table.id);
      }
    } finally {
      setLoading(false);
    }
  };

  const sendRequest = async () => {
    if (!table || !requestMsg.trim()) return;
    await fetch("/api/requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ table_id: table.id, order_id: orderId, message: requestMsg.trim(), restaurant_id: restaurantId }),
    });
    setRequestMsg("");
    setShowRequest(false);
    showToast(tr.requestSent);
  };

  const hasActiveOrder = orderStatus.pending > 0 || orderStatus.completed > 0;

  return (
    <div className={`min-h-screen font-sans ${dark ? "bg-gray-950 text-white" : "bg-gray-100 text-gray-900"}`}>
      {/* Header */}
      <div className="bg-kakao-yellow sticky top-0 z-40 shadow-sm">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="font-bold text-kakao-brown text-lg">
              {table ? (lang === "ko" ? table.name : `Table ${table.number}`) : "..."}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {/* Dark mode toggle */}
            <button
              onClick={() => setDark(!dark)}
              className="w-8 h-8 bg-white/40 rounded-full flex items-center justify-center text-lg"
            >
              {dark ? "☀️" : "🌙"}
            </button>
            {/* Language */}
            <div className="flex bg-white/40 rounded-full p-0.5">
              {(["ko", "en"] as Lang[]).map((l) => (
                <button
                  key={l}
                  onClick={() => setLang(l)}
                  className={`px-3 py-0.5 rounded-full text-xs font-bold transition-all ${lang === l ? "bg-kakao-brown text-white" : "text-kakao-brown"}`}
                >
                  {l === "ko" ? "한" : "EN"}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Category Tabs */}
      <div className={`sticky top-14 z-30 border-b ${dark ? "bg-gray-900 border-gray-800" : "bg-white border-gray-100"}`}>
        <div className="max-w-lg mx-auto">
          <div className="flex overflow-x-auto scrollbar-hide px-4 py-2 gap-2">
            <button
              onClick={() => setSelectedCat("all")}
              className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium ${selectedCat === "all" ? "bg-kakao-yellow text-kakao-brown font-bold" : dark ? "bg-gray-800 text-gray-400" : "bg-gray-100 text-gray-500"}`}
            >
              {tr.all}
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCat(cat.id)}
                className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium ${selectedCat === cat.id ? "bg-kakao-yellow text-kakao-brown font-bold" : dark ? "bg-gray-800 text-gray-400" : "bg-gray-100 text-gray-500"}`}
              >
                {lang === "ko" ? cat.name_ko : cat.name_en}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Menu Grid */}
      <div className="max-w-lg mx-auto px-4 py-4 pb-40">
        <div className="grid grid-cols-2 gap-3">
          {filtered.map((item) => {
            const inCart = cart.find((c) => c.menu_item_id === item.id);
            const soldOut = item.is_sold_out;
            return (
              <div
                key={item.id}
                className={`rounded-2xl overflow-hidden shadow-sm transition-transform active:scale-95 ${dark ? "bg-gray-800" : "bg-white"} ${soldOut ? "opacity-60" : ""}`}
              >
                {item.image_url ? (
                  <div className="relative h-32">
                    <Image src={item.image_url} alt={item.name_ko} fill className="object-cover" />
                    {soldOut && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                        <span className="text-white font-bold text-sm bg-red-500 px-3 py-1 rounded-full">{tr.soldOut}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className={`h-24 flex items-center justify-center text-4xl relative ${dark ? "bg-gray-700" : "bg-kakao-yellow/30"}`}>
                    🍽️
                    {soldOut && (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center rounded-t-2xl">
                        <span className="text-white font-bold text-xs bg-red-500 px-2 py-0.5 rounded-full">{tr.soldOut}</span>
                      </div>
                    )}
                  </div>
                )}
                <div className="p-3">
                  <p className={`font-semibold text-sm leading-tight ${dark ? "text-white" : "text-gray-800"}`}>
                    {lang === "ko" ? item.name_ko : item.name_en}
                  </p>
                  {(lang === "ko" ? item.description_ko : item.description_en) && (
                    <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">
                      {lang === "ko" ? item.description_ko : item.description_en}
                    </p>
                  )}
                  <div className="flex items-center justify-between mt-2">
                    <span className="font-bold text-kakao-brown text-sm">
                      {tr.won}{item.price.toLocaleString()}
                    </span>
                    {soldOut ? (
                      <span className="text-xs text-gray-400">{tr.soldOut}</span>
                    ) : inCart ? (
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => changeQty(item.id, -1)} className={`w-6 h-6 rounded-full border flex items-center justify-center text-xs ${dark ? "border-gray-600 text-gray-300" : "border-gray-200"}`}>−</button>
                        <span className="text-sm font-bold w-4 text-center">{inCart.quantity}</span>
                        <button onClick={() => addToCart(item)} className="w-6 h-6 rounded-full bg-kakao-yellow flex items-center justify-center text-xs font-bold">+</button>
                      </div>
                    ) : (
                      <button
                        onClick={() => addToCart(item)}
                        className="bg-kakao-yellow text-kakao-brown text-xs font-bold px-3 py-1.5 rounded-full"
                      >
                        {tr.add}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Order Status Bar (bottom, above action bar) */}
      {hasActiveOrder && (
        <div
          className={`fixed bottom-24 left-0 right-0 z-30 max-w-lg mx-auto px-4`}
          onClick={() => setShowMyOrder(true)}
        >
          <div className={`rounded-2xl px-4 py-2.5 flex items-center justify-between shadow-lg cursor-pointer ${dark ? "bg-gray-800 border border-gray-700" : "bg-white border border-gray-200"}`}>
            <div className="flex items-center gap-3 text-sm">
              {orderStatus.pending > 0 && (
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-orange-400 animate-pulse" />
                  <span className={dark ? "text-orange-300" : "text-orange-500"}>{tr.preparing} {orderStatus.pending}</span>
                </span>
              )}
              {orderStatus.completed > 0 && (
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-green-400" />
                  <span className={dark ? "text-green-300" : "text-green-600"}>{tr.ready} {orderStatus.completed}</span>
                </span>
              )}
            </div>
            <span className="font-bold text-kakao-brown text-sm">
              {tr.won}{orderStatus.total.toLocaleString()}
            </span>
          </div>
        </div>
      )}

      {/* Bottom Action Bar */}
      <div className={`fixed bottom-0 left-0 right-0 z-40 ${dark ? "bg-gray-950" : "bg-gray-100"}`}>
        <div className="max-w-lg mx-auto px-4 pb-6 pt-3 flex gap-2">
          <button
            onClick={() => setShowRequest(true)}
            className={`flex-shrink-0 border-2 border-kakao-yellow font-bold py-3.5 px-4 rounded-2xl text-sm ${dark ? "bg-gray-900 text-kakao-yellow" : "bg-white text-kakao-brown"}`}
          >
            📣
          </button>
          <button
            onClick={() => cart.length > 0 && setShowCart(true)}
            disabled={cart.length === 0}
            className={`flex-1 py-3.5 px-4 rounded-2xl font-bold text-sm flex items-center justify-between transition-all ${cart.length > 0 ? "bg-kakao-yellow text-kakao-brown" : dark ? "bg-gray-800 text-gray-600" : "bg-gray-200 text-gray-400"}`}
          >
            <span>
              {totalCount > 0 && <span className="bg-kakao-brown text-white text-xs rounded-full px-2 py-0.5 mr-2">{totalCount}</span>}
              {tr.cart}
            </span>
            {totalPrice > 0 && <span>{tr.won}{totalPrice.toLocaleString()}</span>}
          </button>
        </div>
      </div>

      {/* Cart Modal */}
      {showCart && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowCart(false)} />
          <div className={`relative w-full max-w-lg rounded-t-3xl shadow-2xl max-h-[80vh] flex flex-col ${dark ? "bg-gray-900" : "bg-white"}`}>
            <div className={`flex items-center justify-between px-5 pt-5 pb-3 border-b ${dark ? "border-gray-800" : "border-gray-100"}`}>
              <h2 className="text-lg font-bold">{tr.cart}</h2>
              <button onClick={() => setShowCart(false)} className="text-gray-400 text-2xl">×</button>
            </div>
            <div className="flex-1 overflow-y-auto px-5">
              {cart.length === 0 ? (
                <p className="text-center text-gray-400 py-12">{tr.empty}</p>
              ) : cart.map((item) => (
                <div key={item.menu_item_id} className={`flex items-center justify-between py-3 border-b last:border-0 ${dark ? "border-gray-800" : "border-gray-100"}`}>
                  <div className="flex-1">
                    <p className="font-medium text-sm">{lang === "ko" ? item.name_ko : item.name_en}</p>
                    <p className="text-xs text-gray-400">{tr.won}{(item.price * item.quantity).toLocaleString()}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => changeQty(item.menu_item_id, -1)} className={`w-7 h-7 rounded-full border flex items-center justify-center ${dark ? "border-gray-700" : "border-gray-200"}`}>−</button>
                    <span className="w-5 text-center font-bold">{item.quantity}</span>
                    <button onClick={() => changeQty(item.menu_item_id, 1)} className="w-7 h-7 rounded-full bg-kakao-yellow flex items-center justify-center font-bold">+</button>
                  </div>
                </div>
              ))}
            </div>
            {cart.length > 0 && (
              <div className={`px-5 py-4 border-t ${dark ? "border-gray-800" : "border-gray-100"}`}>
                <div className="flex justify-between mb-4">
                  <span className="text-gray-400">{tr.total}</span>
                  <span className="font-bold text-lg text-kakao-brown">{tr.won}{totalPrice.toLocaleString()}</span>
                </div>
                <button
                  onClick={placeOrder}
                  disabled={loading}
                  className="w-full bg-kakao-yellow text-kakao-brown font-bold py-4 rounded-2xl disabled:opacity-60"
                >
                  {loading ? "..." : tr.order}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Request Modal */}
      {showRequest && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowRequest(false)} />
          <div className={`relative w-full max-w-lg rounded-t-3xl shadow-2xl p-5 ${dark ? "bg-gray-900" : "bg-white"}`}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">{tr.requestTitle}</h2>
              <button onClick={() => setShowRequest(false)} className="text-gray-400 text-2xl">×</button>
            </div>
            <textarea
              value={requestMsg}
              onChange={(e) => setRequestMsg(e.target.value)}
              placeholder={tr.requestPlaceholder}
              rows={3}
              className={`w-full border rounded-xl p-3 text-sm resize-none focus:outline-none focus:border-kakao-yellow ${dark ? "bg-gray-800 border-gray-700 text-white" : "border-gray-200"}`}
            />
            <div className="flex flex-wrap gap-2 mt-3">
              {quickRequests[lang].map((q) => (
                <button
                  key={q}
                  onClick={() => setRequestMsg(q)}
                  className={`text-xs px-3 py-1.5 rounded-full transition-colors ${dark ? "bg-gray-800 text-gray-300 hover:bg-kakao-yellow hover:text-kakao-brown" : "bg-gray-100 text-gray-500 hover:bg-kakao-yellow hover:text-kakao-brown"}`}
                >
                  {q}
                </button>
              ))}
            </div>
            <button
              onClick={sendRequest}
              disabled={!requestMsg.trim()}
              className="w-full bg-kakao-yellow text-kakao-brown font-bold py-3.5 rounded-2xl text-sm mt-4 disabled:opacity-50"
            >
              {tr.send}
            </button>
          </div>
        </div>
      )}

      {/* My Order Modal */}
      {showMyOrder && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowMyOrder(false)} />
          <div className={`relative w-full max-w-lg rounded-t-3xl shadow-2xl p-5 max-h-[70vh] flex flex-col ${dark ? "bg-gray-900" : "bg-white"}`}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">{tr.myOrder}</h2>
              <button onClick={() => setShowMyOrder(false)} className="text-gray-400 text-2xl">×</button>
            </div>
            <div className="flex gap-4 mb-4">
              <div className="flex-1 bg-orange-50 dark:bg-orange-900/30 rounded-2xl p-3 text-center">
                <p className="text-2xl font-black text-orange-500">{orderStatus.pending}</p>
                <p className="text-xs text-orange-400 mt-0.5">{tr.preparing}</p>
              </div>
              <div className="flex-1 bg-green-50 dark:bg-green-900/30 rounded-2xl p-3 text-center">
                <p className="text-2xl font-black text-green-500">{orderStatus.completed}</p>
                <p className="text-xs text-green-400 mt-0.5">{tr.ready}</p>
              </div>
              <div className={`flex-1 rounded-2xl p-3 text-center ${dark ? "bg-gray-800" : "bg-gray-100"}`}>
                <p className="text-lg font-black text-kakao-brown">{tr.won}{orderStatus.total.toLocaleString()}</p>
                <p className="text-xs text-gray-400 mt-0.5">{tr.total}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white px-5 py-3 rounded-2xl text-sm font-medium shadow-xl">
          {toast}
        </div>
      )}
    </div>
  );
}
