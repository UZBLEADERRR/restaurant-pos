"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase, Category } from "@/lib/supabase";
import Image from "next/image";

type Lang = "ko" | "en";

type MenuItem = {
  id: string; category_id: string; name_ko: string; name_en: string;
  price: number; description_ko: string; description_en: string;
  image_url: string; staff_type: "kitchen" | "hall";
  is_available: boolean; is_sold_out?: boolean;
};

type CartItem = {
  menu_item_id: string; name_ko: string; name_en: string;
  price: number; quantity: number; staff_type: "kitchen" | "hall";
};

type OrderItemDetail = {
  id: string; name_ko: string; name_en: string;
  price: number; quantity: number; is_completed: boolean; staff_type: "kitchen" | "hall";
  created_at: string;
};

type TableInfo = { id: string; number: number; name: string };

const T = {
  ko: {
    cart: "장바구니", order: "주문하기", request: "요청", send: "보내기",
    total: "합계", empty: "장바구니가 비어있습니다", orderedMsg: "주문이 접수됐어요!",
    requestSent: "전송됐습니다", add: "담기", requestTitle: "직원에게 요청",
    preparing: "준비중", ready: "완료", myOrder: "내 주문", all: "전체",
    soldOut: "품절", close: "닫기", won: "₩", requestPlaceholder: "예: 수저 주세요",
    noTable: "테이블을 찾을 수 없습니다",
  },
  en: {
    cart: "Cart", order: "Place Order", request: "Request", send: "Send",
    total: "Total", empty: "Cart is empty", orderedMsg: "Order placed!",
    requestSent: "Sent!", add: "Add", requestTitle: "Request to Staff",
    preparing: "Preparing", ready: "Ready", myOrder: "My Order", all: "All",
    soldOut: "Sold Out", close: "Close", won: "₩", requestPlaceholder: "e.g. Bring spoons please",
    noTable: "Table not found",
  },
};

const QUICK = {
  ko: ["수저 주세요", "냅킨 주세요", "물 주세요", "포크 주세요", "직원 불러주세요"],
  en: ["Chopsticks please", "Napkin please", "Water please", "Fork please", "Call staff"],
};

export default function CustomerPage({ params }: { params: { restaurantId: string; tableNumber: string } }) {
  const { restaurantId, tableNumber } = params;

  const [lang, setLang] = useState<Lang>("ko");
  const [dark, setDark] = useState(false);
  const [table, setTable] = useState<TableInfo | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [selectedCat, setSelectedCat] = useState("all");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [myOrderItems, setMyOrderItems] = useState<OrderItemDetail[]>([]);
  const [orderTotal, setOrderTotal] = useState(0);

  const [showCart, setShowCart] = useState(false);
  const [showRequest, setShowRequest] = useState(false);
  const [showMyOrder, setShowMyOrder] = useState(false);
  const [requestMsg, setRequestMsg] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const tr = T[lang];

  // Dark mode
  useEffect(() => {
    try {
      const s = localStorage.getItem("theme");
      const sys = window.matchMedia("(prefers-color-scheme: dark)").matches;
      const d = s ? s === "dark" : sys;
      setDark(d);
      document.documentElement.classList.toggle("dark", d);
    } catch {}
  }, []);

  const toggleDark = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try { localStorage.setItem("theme", next ? "dark" : "light"); } catch {}
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const loadMyOrder = useCallback(async (tableId: string) => {
    // Try with restaurant_id, fallback without
    let data = null;
    const q1 = await supabase
      .from("orders")
      .select("id, total_amount, order_items(*)")
      .eq("table_id", tableId)
      .eq("status", "active")
      .maybeSingle();

    if (!q1.error) {
      data = q1.data;
    } else {
      // column might not exist — try without restaurant_id filter
      const q2 = await supabase
        .from("orders")
        .select("id, total_amount, order_items(*)")
        .eq("table_id", tableId)
        .eq("status", "active")
        .maybeSingle();
      if (!q2.error) data = q2.data;
    }

    if (data) {
      setOrderId(data.id);
      setMyOrderItems((data.order_items as OrderItemDetail[]) || []);
      setOrderTotal(data.total_amount);
    } else {
      setOrderId(null);
      setMyOrderItems([]);
      setOrderTotal(0);
    }
  }, []);

  useEffect(() => {
    const load = async () => {
      // 1. Find table — try with restaurant_id, then fallback
      let tableData = null;

      const t1 = await supabase
        .from("restaurant_tables")
        .select("id, number, name")
        .eq("number", tableNumber)
        .eq("restaurant_id", restaurantId)
        .maybeSingle();

      if (!t1.error && t1.data) {
        tableData = t1.data;
      } else {
        // Fallback: find by number only (before migration)
        const t2 = await supabase
          .from("restaurant_tables")
          .select("id, number, name")
          .eq("number", tableNumber)
          .maybeSingle();
        if (!t2.error && t2.data) tableData = t2.data;
      }

      if (!tableData) {
        setNotFound(true);
        return;
      }
      setTable(tableData);
      loadMyOrder(tableData.id);

      // 2. Categories — try with restaurant_id, fallback
      let cats = null;
      const c1 = await supabase
        .from("categories")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .eq("is_active", true)
        .order("sort_order");
      if (!c1.error) cats = c1.data;
      else {
        const c2 = await supabase.from("categories").select("*").eq("is_active", true).order("sort_order");
        if (!c2.error) cats = c2.data;
      }
      if (cats) setCategories(cats);

      // 3. Menu items — try with restaurant_id, fallback
      let items = null;
      const m1 = await supabase
        .from("menu_items")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .eq("is_available", true)
        .order("sort_order");
      if (!m1.error) items = m1.data;
      else {
        const m2 = await supabase.from("menu_items").select("*").eq("is_available", true).order("sort_order");
        if (!m2.error) items = m2.data;
      }
      if (items) setMenuItems(items);
    };
    load();
  }, [restaurantId, tableNumber, loadMyOrder]);

  // Poll order every 10s
  useEffect(() => {
    if (!table) return;
    const iv = setInterval(() => loadMyOrder(table.id), 10000);
    return () => clearInterval(iv);
  }, [table, loadMyOrder]);

  // Cart helpers
  const cartCount = cart.reduce((s, c) => s + c.quantity, 0);
  const cartTotal = cart.reduce((s, c) => s + c.price * c.quantity, 0);
  const filtered = selectedCat === "all" ? menuItems : menuItems.filter(m => m.category_id === selectedCat);

  const addToCart = (item: MenuItem) => {
    if (item.is_sold_out) return;
    setCart(prev => {
      const ex = prev.find(c => c.menu_item_id === item.id);
      if (ex) return prev.map(c => c.menu_item_id === item.id ? { ...c, quantity: c.quantity + 1 } : c);
      return [...prev, { menu_item_id: item.id, name_ko: item.name_ko, name_en: item.name_en, price: item.price, quantity: 1, staff_type: item.staff_type }];
    });
  };

  const changeQty = (id: string, delta: number) =>
    setCart(prev => prev.map(c => c.menu_item_id === id ? { ...c, quantity: c.quantity + delta } : c).filter(c => c.quantity > 0));

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
        setCart([]);
        setShowCart(false);
        showToast(tr.orderedMsg);
        await loadMyOrder(table.id);
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

  const pendingCount = myOrderItems.filter(i => !i.is_completed).length;
  const doneCount = myOrderItems.filter(i => i.is_completed).length;
  const hasOrder = myOrderItems.length > 0;

  if (notFound) {
    return (
      <div className="min-h-screen bg-kakao-yellow flex flex-col items-center justify-center">
        <span className="text-6xl mb-4">🍽️</span>
        <p className="text-kakao-brown font-bold text-lg">{tr.noTable}</p>
        <p className="text-kakao-brown/60 text-sm mt-1">Table {tableNumber}</p>
      </div>
    );
  }

  return (
    <div className={`min-h-screen font-sans ${dark ? "bg-gray-950" : "bg-gray-100"}`}>

      {/* ── HEADER ── */}
      <div className="bg-kakao-yellow sticky top-0 z-40 shadow-sm">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="font-bold text-kakao-brown text-base leading-tight">
              {table ? (lang === "ko" ? table.name : `Table ${table.number}`) : "..."}
            </h1>
            {hasOrder && (
              <p className="text-xs text-kakao-brown/60">
                {pendingCount > 0 ? `준비중 ${pendingCount}` : "모두 준비됨 ✓"}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={toggleDark} className="w-8 h-8 bg-kakao-brown/10 rounded-full flex items-center justify-center">
              {dark ? "☀️" : "🌙"}
            </button>
            <div className="flex bg-kakao-brown/10 rounded-full p-0.5">
              {(["ko", "en"] as Lang[]).map(l => (
                <button key={l} onClick={() => setLang(l)}
                  className={`px-2.5 py-0.5 rounded-full text-xs font-bold transition-all ${lang === l ? "bg-kakao-brown text-white" : "text-kakao-brown"}`}>
                  {l === "ko" ? "한" : "EN"}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── CATEGORY TABS ── */}
      <div className={`sticky top-14 z-30 border-b ${dark ? "bg-gray-900 border-gray-800" : "bg-white border-gray-100"}`}>
        <div className="flex overflow-x-auto scrollbar-hide px-4 py-2 gap-2 max-w-lg mx-auto">
          <button onClick={() => setSelectedCat("all")}
            className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium ${selectedCat === "all" ? "bg-kakao-yellow text-kakao-brown font-bold" : dark ? "bg-gray-800 text-gray-400" : "bg-gray-100 text-gray-500"}`}>
            {tr.all}
          </button>
          {categories.map(cat => (
            <button key={cat.id} onClick={() => setSelectedCat(cat.id)}
              className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium ${selectedCat === cat.id ? "bg-kakao-yellow text-kakao-brown font-bold" : dark ? "bg-gray-800 text-gray-400" : "bg-gray-100 text-gray-500"}`}>
              {lang === "ko" ? cat.name_ko : cat.name_en}
            </button>
          ))}
        </div>
      </div>

      {/* ── MENU GRID ── */}
      <div className="max-w-lg mx-auto px-4 py-4 pb-44">
        {filtered.length === 0 && (
          <p className="text-center text-gray-400 py-12 text-sm">메뉴가 없습니다</p>
        )}
        <div className="grid grid-cols-2 gap-3">
          {filtered.map(item => {
            const inCart = cart.find(c => c.menu_item_id === item.id);
            const soldOut = !!item.is_sold_out;
            return (
              <div key={item.id} className={`rounded-2xl overflow-hidden shadow-sm ${dark ? "bg-gray-800" : "bg-white"} ${soldOut ? "opacity-60" : "active:scale-95 transition-transform"}`}>
                {item.image_url ? (
                  <div className="relative h-32">
                    <Image src={item.image_url} alt={item.name_ko} fill className="object-cover" />
                    {soldOut && <div className="absolute inset-0 bg-black/50 flex items-center justify-center"><span className="text-white font-bold text-xs bg-red-500 px-2 py-0.5 rounded-full">{tr.soldOut}</span></div>}
                  </div>
                ) : (
                  <div className={`h-24 flex items-center justify-center relative ${dark ? "bg-gray-700" : "bg-kakao-yellow/20"}`}>
                    <span className="text-3xl">🍽️</span>
                    {soldOut && <div className="absolute inset-0 bg-black/40 flex items-center justify-center"><span className="text-white font-bold text-xs bg-red-500 px-2 py-0.5 rounded-full">{tr.soldOut}</span></div>}
                  </div>
                )}
                <div className="p-3">
                  <p className={`font-semibold text-sm leading-tight ${dark ? "text-white" : "text-gray-800"}`}>
                    {lang === "ko" ? item.name_ko : item.name_en}
                  </p>
                  <div className="flex items-center justify-between mt-2">
                    <span className="font-bold text-kakao-brown text-sm">{tr.won}{item.price.toLocaleString()}</span>
                    {soldOut ? (
                      <span className="text-xs text-gray-400">{tr.soldOut}</span>
                    ) : inCart ? (
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => changeQty(item.id, -1)} className={`w-6 h-6 rounded-full border flex items-center justify-center text-xs ${dark ? "border-gray-600 text-gray-300" : "border-gray-200 text-gray-500"}`}>−</button>
                        <span className="text-sm font-bold w-4 text-center">{inCart.quantity}</span>
                        <button onClick={() => addToCart(item)} className="w-6 h-6 rounded-full bg-kakao-yellow flex items-center justify-center text-xs font-bold text-kakao-brown">+</button>
                      </div>
                    ) : (
                      <button onClick={() => addToCart(item)} className="bg-kakao-yellow text-kakao-brown text-xs font-bold px-3 py-1.5 rounded-full">
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

      {/* ── MY ORDER STATUS BAR ── */}
      {hasOrder && (
        <div className="fixed bottom-[88px] left-0 right-0 z-30 px-4 max-w-lg mx-auto">
          <button
            onClick={() => setShowMyOrder(true)}
            className={`w-full rounded-2xl px-4 py-2.5 flex items-center justify-between shadow-lg border ${dark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"}`}
          >
            <div className="flex items-center gap-3 text-sm">
              <span className={`font-bold ${dark ? "text-white" : "text-gray-700"}`}>{tr.myOrder}</span>
              {pendingCount > 0 && (
                <span className="flex items-center gap-1 text-orange-500 dark:text-orange-400">
                  <span className="w-2 h-2 rounded-full bg-orange-400 animate-pulse" />
                  {tr.preparing} {pendingCount}
                </span>
              )}
              {doneCount > 0 && (
                <span className="flex items-center gap-1 text-green-500 dark:text-green-400">
                  <span className="w-2 h-2 rounded-full bg-green-400" />
                  {tr.ready} {doneCount}
                </span>
              )}
            </div>
            <span className="font-black text-kakao-brown">{tr.won}{orderTotal.toLocaleString()}</span>
          </button>
        </div>
      )}

      {/* ── BOTTOM ACTIONS ── */}
      <div className={`fixed bottom-0 left-0 right-0 z-40 ${dark ? "bg-gray-950" : "bg-gray-100"}`}>
        <div className="max-w-lg mx-auto px-4 pb-6 pt-3 flex gap-2">
          <button onClick={() => setShowRequest(true)}
            className={`flex-shrink-0 border-2 border-kakao-yellow font-bold py-3.5 px-4 rounded-2xl text-sm ${dark ? "bg-gray-900 text-kakao-yellow" : "bg-white text-kakao-brown"}`}>
            📣
          </button>
          <button
            onClick={() => cartCount > 0 && setShowCart(true)}
            disabled={cartCount === 0}
            className={`flex-1 py-3.5 px-4 rounded-2xl font-bold text-sm flex items-center justify-between ${cartCount > 0 ? "bg-kakao-yellow text-kakao-brown" : dark ? "bg-gray-800 text-gray-600" : "bg-gray-200 text-gray-400"}`}>
            <span>
              {cartCount > 0 && <span className="bg-kakao-brown text-white text-xs rounded-full px-2 py-0.5 mr-2">{cartCount}</span>}
              {tr.cart}
            </span>
            {cartTotal > 0 && <span>{tr.won}{cartTotal.toLocaleString()}</span>}
          </button>
        </div>
      </div>

      {/* ── CART MODAL ── */}
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
                <p className="text-center text-gray-400 py-10">{tr.empty}</p>
              ) : cart.map(item => (
                <div key={item.menu_item_id} className={`flex items-center justify-between py-3 border-b last:border-0 ${dark ? "border-gray-800" : "border-gray-100"}`}>
                  <div className="flex-1">
                    <p className="font-medium text-sm">{lang === "ko" ? item.name_ko : item.name_en}</p>
                    <p className="text-xs text-gray-400">{tr.won}{(item.price * item.quantity).toLocaleString()}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => changeQty(item.menu_item_id, -1)} className={`w-7 h-7 rounded-full border flex items-center justify-center ${dark ? "border-gray-700" : "border-gray-200"}`}>−</button>
                    <span className="w-5 text-center font-bold text-sm">{item.quantity}</span>
                    <button onClick={() => changeQty(item.menu_item_id, 1)} className="w-7 h-7 rounded-full bg-kakao-yellow flex items-center justify-center font-bold text-kakao-brown">+</button>
                  </div>
                </div>
              ))}
            </div>
            {cart.length > 0 && (
              <div className={`px-5 py-4 border-t ${dark ? "border-gray-800" : "border-gray-100"}`}>
                <div className="flex justify-between mb-4">
                  <span className="text-gray-400">{tr.total}</span>
                  <span className="font-bold text-lg text-kakao-brown">{tr.won}{cartTotal.toLocaleString()}</span>
                </div>
                <button onClick={placeOrder} disabled={loading}
                  className="w-full bg-kakao-yellow text-kakao-brown font-bold py-4 rounded-2xl disabled:opacity-60">
                  {loading ? "..." : tr.order}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── MY ORDER MODAL ── */}
      {showMyOrder && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowMyOrder(false)} />
          <div className={`relative w-full max-w-lg rounded-t-3xl shadow-2xl max-h-[85vh] flex flex-col ${dark ? "bg-gray-900" : "bg-white"}`}>
            <div className={`flex items-center justify-between px-5 pt-5 pb-3 border-b ${dark ? "border-gray-800" : "border-gray-100"}`}>
              <h2 className="text-lg font-bold">{tr.myOrder}</h2>
              <button onClick={() => setShowMyOrder(false)} className="text-gray-400 text-2xl">×</button>
            </div>

            {/* Summary chips */}
            <div className="flex gap-3 px-5 py-3">
              <div className="flex-1 bg-orange-50 dark:bg-orange-950/40 rounded-2xl p-3 text-center">
                <p className="text-2xl font-black text-orange-500">{pendingCount}</p>
                <p className="text-xs text-orange-400 mt-0.5">{tr.preparing}</p>
              </div>
              <div className="flex-1 bg-green-50 dark:bg-green-950/40 rounded-2xl p-3 text-center">
                <p className="text-2xl font-black text-green-500">{doneCount}</p>
                <p className="text-xs text-green-400 mt-0.5">{tr.ready}</p>
              </div>
              <div className={`flex-1 rounded-2xl p-3 text-center ${dark ? "bg-gray-800" : "bg-gray-100"}`}>
                <p className="text-base font-black text-kakao-brown leading-tight">{tr.won}{orderTotal.toLocaleString()}</p>
                <p className="text-xs text-gray-400 mt-0.5">{tr.total}</p>
              </div>
            </div>

            {/* Order items list */}
            <div className="flex-1 overflow-y-auto px-5 pb-5">
              {myOrderItems.length === 0 ? (
                <p className="text-center text-gray-400 py-6 text-sm">주문 내역 없음</p>
              ) : (
                <div className="space-y-2">
                  {myOrderItems
                    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
                    .map(item => (
                      <div key={item.id} className={`flex items-center gap-3 p-3 rounded-2xl ${item.is_completed ? (dark ? "bg-green-950/30" : "bg-green-50") : (dark ? "bg-orange-950/30" : "bg-orange-50")}`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-base flex-shrink-0 ${item.is_completed ? "bg-green-100 dark:bg-green-900/50" : "bg-orange-100 dark:bg-orange-900/50"}`}>
                          {item.is_completed ? "✅" : "⏳"}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-semibold ${item.is_completed ? "text-green-700 dark:text-green-300" : dark ? "text-orange-300" : "text-orange-700"}`}>
                            {lang === "ko" ? item.name_ko : item.name_en}
                          </p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            ×{item.quantity} · {tr.won}{(item.price * item.quantity).toLocaleString()}
                          </p>
                        </div>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${item.is_completed ? "bg-green-200 dark:bg-green-800 text-green-700 dark:text-green-200" : "bg-orange-200 dark:bg-orange-800 text-orange-700 dark:text-orange-200"}`}>
                          {item.is_completed ? tr.ready : tr.preparing}
                        </span>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── REQUEST MODAL ── */}
      {showRequest && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowRequest(false)} />
          <div className={`relative w-full max-w-lg rounded-t-3xl shadow-2xl p-5 ${dark ? "bg-gray-900" : "bg-white"}`}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">{tr.requestTitle}</h2>
              <button onClick={() => setShowRequest(false)} className="text-gray-400 text-2xl">×</button>
            </div>
            <textarea value={requestMsg} onChange={e => setRequestMsg(e.target.value)}
              placeholder={tr.requestPlaceholder} rows={3}
              className={`w-full border rounded-xl p-3 text-sm resize-none focus:outline-none focus:border-kakao-yellow ${dark ? "bg-gray-800 border-gray-700 text-white" : "border-gray-200"}`} />
            <div className="flex flex-wrap gap-2 mt-3">
              {QUICK[lang].map(q => (
                <button key={q} onClick={() => setRequestMsg(q)}
                  className={`text-xs px-3 py-1.5 rounded-full ${dark ? "bg-gray-800 text-gray-300 hover:bg-kakao-yellow hover:text-kakao-brown" : "bg-gray-100 text-gray-500 hover:bg-kakao-yellow hover:text-kakao-brown"}`}>
                  {q}
                </button>
              ))}
            </div>
            <button onClick={sendRequest} disabled={!requestMsg.trim()}
              className="w-full bg-kakao-yellow text-kakao-brown font-bold py-3.5 rounded-2xl text-sm mt-4 disabled:opacity-50">
              {tr.send}
            </button>
          </div>
        </div>
      )}

      {/* ── TOAST ── */}
      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-gray-900 dark:bg-gray-700 text-white px-5 py-3 rounded-2xl text-sm font-medium shadow-xl whitespace-nowrap">
          {toast}
        </div>
      )}
    </div>
  );
}
