"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import Image from "next/image";

type Lang = "ko" | "en";
type Tab = "menu" | "call" | "order";

type Category = { id: string; name_ko: string; name_en: string; staff_type: string };
type MenuItem = {
  id: string; category_id: string; name_ko: string; name_en: string;
  price: number; description_ko: string; description_en: string;
  image_url: string; staff_type: "kitchen" | "hall"; is_sold_out?: boolean;
};
type CartItem = {
  menu_item_id: string; name_ko: string; name_en: string;
  price: number; quantity: number; staff_type: "kitchen" | "hall";
};
type OrderItemDetail = {
  id: string; name_ko: string; name_en: string; price: number;
  quantity: number; is_completed: boolean; staff_type: string; created_at: string;
};
type TableInfo = { id: string; number: number; name: string };

const T = {
  ko: {
    menu: "메뉴", call: "직원호출", myOrder: "내 주문",
    add: "담기", soldOut: "품절", all: "전체",
    cart: "장바구니", order: "주문하기", total: "합계",
    empty: "장바구니가 비어 있어요", ordered: "주문 접수됐습니다 🎉",
    preparing: "준비중", ready: "완료", noOrders: "아직 주문이 없어요",
    send: "요청 보내기", callPlaceholder: "예: 수저 주세요, 물 주세요...",
    requestSent: "요청을 보냈습니다 ✓", won: "₩",
    guestTitle: "몇 분이 오셨나요?", guestBtn: "입장하기", guestPerson: "명",
    tableNotFound: "테이블을 찾을 수 없습니다", retry: "다시 시도",
    paidTitle: "결제 완료!", paidSub: "이용해 주셔서 감사합니다 😊",
  },
  en: {
    menu: "Menu", call: "Call Staff", myOrder: "My Order",
    add: "Add", soldOut: "Sold Out", all: "All",
    cart: "Cart", order: "Place Order", total: "Total",
    empty: "Your cart is empty", ordered: "Order received 🎉",
    preparing: "Preparing", ready: "Ready", noOrders: "No orders yet",
    send: "Send Request", callPlaceholder: "e.g. Bring spoons, water please...",
    requestSent: "Request sent ✓", won: "₩",
    guestTitle: "How many guests?", guestBtn: "Enter", guestPerson: "guests",
    tableNotFound: "Table not found", retry: "Retry",
    paidTitle: "Payment Complete!", paidSub: "Thank you for dining with us 😊",
  },
};

const QUICK = {
  ko: ["🥄 수저 주세요", "🧻 냅킨 주세요", "💧 물 주세요", "🍴 포크 주세요", "🔔 직원 불러주세요", "🫙 앞접시 주세요"],
  en: ["🥄 Chopsticks", "🧻 Napkin", "💧 Water", "🍴 Fork", "🔔 Call Staff", "🫙 Side plate"],
};

export default function CustomerPage({ params }: { params: { restaurantId: string; tableNumber: string } }) {
  const { restaurantId, tableNumber } = params;

  const [lang, setLang] = useState<Lang>("ko");
  const [dark, setDark] = useState(false);
  const [tab, setTab] = useState<Tab>("menu");

  const [table, setTable] = useState<TableInfo | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [loadRetry, setLoadRetry] = useState(0);
  const [categories, setCategories] = useState<Category[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [selectedCat, setSelectedCat] = useState("all");

  // Cart
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCart, setShowCart] = useState(false);
  const [ordering, setOrdering] = useState(false);

  // Active order
  const [orderId, setOrderId] = useState<string | null>(null);
  const [orderItems, setOrderItems] = useState<OrderItemDetail[]>([]);
  const [orderTotal, setOrderTotal] = useState(0);
  const [justPaid, setJustPaid] = useState(false);

  // Guest count modal state — separate from orderId to avoid flicker
  // null = not yet checked, true = show, false = confirmed or has order
  const [guestModalState, setGuestModalState] = useState<"pending" | "show" | "hidden">("pending");
  const [guestCount, setGuestCount] = useState(2);

  // Call staff
  const [callMsg, setCallMsg] = useState("");
  const [callSent, setCallSent] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

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
    const n = !dark; setDark(n);
    document.documentElement.classList.toggle("dark", n);
    try { localStorage.setItem("theme", n ? "dark" : "light"); } catch {}
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  // Load active order — gracefully handles missing guest_count column
  const loadOrder = useCallback(async (tableId: string, isFirst: boolean) => {
    try {
      // Try with guest_count first, fall back if column doesn't exist
      type OrderRow = { id: string; total_amount: number; guest_count?: number; order_items: OrderItemDetail[] };
      let data: OrderRow | null = null;

      const res1 = await supabase
        .from("orders")
        .select("id, total_amount, guest_count, order_items(*)")
        .eq("table_id", tableId)
        .eq("status", "active")
        .maybeSingle();

      if (res1.error && res1.error.message?.toLowerCase().includes("guest_count")) {
        // Column doesn't exist yet — retry without it
        const res2 = await supabase
          .from("orders")
          .select("id, total_amount, order_items(*)")
          .eq("table_id", tableId)
          .eq("status", "active")
          .maybeSingle();
        data = res2.data as OrderRow | null;
      } else {
        data = res1.data as OrderRow | null;
      }

      if (data) {
        // Active order found
        setOrderId(data.id);
        setOrderItems((data.order_items as OrderItemDetail[]) || []);
        setOrderTotal(data.total_amount || 0);
        if (data.guest_count) setGuestCount(data.guest_count);
        setJustPaid(false);
        // Hide guest modal — table already has an order
        if (isFirst) setGuestModalState("hidden");
      } else {
        // No active order
        setOrderId(prev => {
          if (prev !== null) {
            // Had an order → now it's gone (paid)
            setJustPaid(true);
            setTab("order");
            setTimeout(() => setJustPaid(false), 6000);
          }
          return null;
        });
        setOrderItems([]);
        setOrderTotal(0);
        // On first load with no order → show guest count modal
        if (isFirst) setGuestModalState("show");
      }
    } catch {
      // Network error — don't change modal state
      if (isFirst) setGuestModalState("hidden");
    }
  }, []);

  // Main data load
  useEffect(() => {
    let mounted = true;
    setGuestModalState("pending");

    const load = async () => {
      setPageError(null);
      try {
        // Find table
        let tableData: TableInfo | null = null;
        const t1 = await supabase
          .from("restaurant_tables").select("id, number, name")
          .eq("number", tableNumber).eq("restaurant_id", restaurantId).maybeSingle();
        if (!t1.error && t1.data) tableData = t1.data;
        else {
          const t2 = await supabase
            .from("restaurant_tables").select("id, number, name")
            .eq("number", tableNumber).maybeSingle();
          if (!t2.error) tableData = t2.data;
          else throw new Error(t2.error.message);
        }

        if (!mounted) return;
        if (!tableData) { setPageError("notfound"); return; }
        setTable(tableData);

        // Load categories
        let cats: Category[] = [];
        const c1 = await supabase.from("categories").select("*")
          .eq("restaurant_id", restaurantId).eq("is_active", true).order("sort_order");
        if (!c1.error && c1.data) cats = c1.data;
        else {
          const c2 = await supabase.from("categories").select("*").eq("is_active", true).order("sort_order");
          if (!c2.error && c2.data) cats = c2.data;
        }
        if (mounted) setCategories(cats);

        // Load menu
        let items: MenuItem[] = [];
        const m1 = await supabase.from("menu_items").select("*")
          .eq("restaurant_id", restaurantId).eq("is_available", true).order("sort_order");
        if (!m1.error && m1.data) items = m1.data;
        else {
          const m2 = await supabase.from("menu_items").select("*").eq("is_available", true).order("sort_order");
          if (!m2.error && m2.data) items = m2.data;
        }
        if (mounted) setMenuItems(items);

        // Load order — this determines if we show guest modal
        await loadOrder(tableData.id, true);

      } catch (err) {
        if (mounted) {
          setPageError(err instanceof Error ? err.message : "load_error");
          setGuestModalState("hidden");
        }
      }
    };
    load();
    return () => { mounted = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId, tableNumber, loadRetry]);

  // Real-time + polling
  useEffect(() => {
    if (!table) return;
    const channel = supabase
      .channel(`table-${table.id}-${Date.now()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => loadOrder(table.id, false))
      .on("postgres_changes", { event: "*", schema: "public", table: "order_items" }, () => loadOrder(table.id, false))
      .subscribe();
    const iv = setInterval(() => loadOrder(table.id, false), 8000);
    return () => {
      supabase.removeChannel(channel);
      clearInterval(iv);
    };
  }, [table, loadOrder]);

  // Cart helpers
  const cartCount = cart.reduce((s, c) => s + c.quantity, 0);
  const cartTotal = cart.reduce((s, c) => s + c.price * c.quantity, 0);
  const filteredMenu = selectedCat === "all" ? menuItems : menuItems.filter(m => m.category_id === selectedCat);

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
    setOrdering(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ table_id: table.id, items: cart, restaurant_id: restaurantId, guest_count: guestCount }),
      });
      const data = await res.json();
      if (data.order_id || data.success) {
        setCart([]); setShowCart(false);
        showToast(tr.ordered);
        setTab("order");
        await loadOrder(table.id, false);
      }
    } finally { setOrdering(false); }
  };

  const sendCall = async () => {
    if (!table || !callMsg.trim()) return;
    await fetch("/api/requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ table_id: table.id, order_id: orderId, message: callMsg.trim(), restaurant_id: restaurantId }),
    });
    setCallMsg(""); setCallSent(true);
    showToast(tr.requestSent);
    setTimeout(() => setCallSent(false), 3000);
  };

  const pendingCount = orderItems.filter(i => !i.is_completed).length;
  const doneCount = orderItems.filter(i => i.is_completed).length;
  const showGuestModal = guestModalState === "show";

  // ── Error states ──
  if (pageError === "notfound") {
    return (
      <div className="min-h-screen bg-kakao-yellow flex flex-col items-center justify-center gap-3 p-8">
        <span className="text-6xl">🍽️</span>
        <p className="font-bold text-kakao-brown text-xl">{tr.tableNotFound}</p>
        <p className="text-kakao-brown/60 text-sm">Table {tableNumber}</p>
      </div>
    );
  }
  if (pageError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-gray-50 dark:bg-gray-950 p-8">
        <span className="text-5xl">⚠️</span>
        <p className="font-bold text-gray-700 dark:text-gray-200">연결 오류가 발생했습니다</p>
        <p className="text-xs text-gray-400 text-center max-w-xs">{pageError}</p>
        <button onClick={() => setLoadRetry(r => r + 1)}
          className="bg-kakao-yellow text-kakao-brown font-bold px-6 py-3 rounded-2xl">
          {tr.retry}
        </button>
      </div>
    );
  }

  return (
    // 100dvh accounts for mobile browser bars (Safari, Chrome)
    <div
      className={`flex flex-col overflow-hidden font-sans ${dark ? "bg-gray-950 text-white" : "bg-gray-50 text-gray-900"}`}
      style={{ height: "100dvh" }}
    >

      {/* ── GUEST COUNT MODAL ── */}
      {showGuestModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6">
          <div className={`w-full max-w-xs rounded-3xl p-6 shadow-2xl ${dark ? "bg-gray-900" : "bg-white"}`}>
            <div className="text-center mb-6">
              <span className="text-5xl">👥</span>
              <h2 className="text-xl font-black mt-3 mb-1">{tr.guestTitle}</h2>
              <p className="text-sm text-gray-400">{table?.name || `Table ${tableNumber}`}</p>
            </div>
            <div className="flex items-center justify-center gap-5 mb-4">
              <button
                onClick={() => setGuestCount(g => Math.max(1, g - 1))}
                className={`w-14 h-14 rounded-full text-3xl font-bold flex items-center justify-center ${dark ? "bg-gray-800" : "bg-gray-100"}`}
              >−</button>
              <span className="text-6xl font-black text-kakao-yellow w-20 text-center">{guestCount}</span>
              <button
                onClick={() => setGuestCount(g => Math.min(20, g + 1))}
                className={`w-14 h-14 rounded-full text-3xl font-bold flex items-center justify-center ${dark ? "bg-gray-800" : "bg-gray-100"}`}
              >+</button>
            </div>
            <p className="text-center text-sm text-gray-400 mb-5">{guestCount} {tr.guestPerson}</p>
            <button
              onClick={() => setGuestModalState("hidden")}
              className="w-full bg-kakao-yellow text-kakao-brown font-black py-4 rounded-2xl text-lg active:scale-95 transition-transform"
            >
              {tr.guestBtn} →
            </button>
          </div>
        </div>
      )}

      {/* ── HEADER ── */}
      <div className="bg-kakao-yellow flex-shrink-0">
        <div className="max-w-lg mx-auto px-4 pt-3 pb-2.5 flex items-center justify-between">
          <div>
            <h1 className="font-black text-kakao-brown text-lg leading-tight">
              {table ? table.name : `Table ${tableNumber}`}
            </h1>
            <div className="flex items-center gap-2 mt-0.5">
              <button
                onClick={() => setGuestModalState("show")}
                className="text-xs text-kakao-brown/70 hover:text-kakao-brown"
              >
                👥 {guestCount}{lang === "ko" ? "명" : " guests"} ✏️
              </button>
              {pendingCount > 0 && (
                <span className="text-xs text-kakao-brown/70">· ⏳ {pendingCount}개 준비중</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={toggleDark}
              className="w-8 h-8 bg-kakao-brown/10 rounded-full flex items-center justify-center text-base">
              {dark ? "☀️" : "🌙"}
            </button>
            <div className="flex bg-kakao-brown/10 rounded-full p-0.5">
              {(["ko", "en"] as Lang[]).map(l => (
                <button key={l} onClick={() => setLang(l)}
                  className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${lang === l ? "bg-kakao-brown text-white" : "text-kakao-brown"}`}>
                  {l === "ko" ? "한" : "EN"}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── CATEGORY TABS ── */}
      {tab === "menu" && (
        <div className={`flex-shrink-0 border-b ${dark ? "bg-gray-900 border-gray-800" : "bg-white border-gray-100"}`}>
          <div className="flex overflow-x-auto scrollbar-hide px-4 py-2 gap-2 max-w-lg mx-auto">
            {[{ id: "all", name_ko: tr.all, name_en: tr.all }, ...categories].map(cat => (
              <button key={cat.id} onClick={() => setSelectedCat(cat.id)}
                className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-all ${selectedCat === cat.id ? "bg-kakao-yellow text-kakao-brown font-bold" : dark ? "bg-gray-800 text-gray-400" : "bg-gray-100 text-gray-500"}`}>
                {lang === "ko" ? cat.name_ko : (cat as Category).name_en || cat.name_ko}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── MAIN CONTENT ── */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-lg mx-auto">

          {/* TAB: MENU */}
          {tab === "menu" && (
            <div className="p-4 pb-6 grid grid-cols-2 gap-3">
              {filteredMenu.length === 0 && (
                <div className="col-span-2 py-16 text-center text-gray-400 dark:text-gray-600">
                  <p className="text-4xl mb-3">🍽️</p>
                  <p className="text-sm">메뉴가 없습니다</p>
                </div>
              )}
              {filteredMenu.map(item => {
                const inCart = cart.find(c => c.menu_item_id === item.id);
                const soldOut = !!item.is_sold_out;
                return (
                  <div key={item.id} className={`rounded-2xl overflow-hidden shadow-sm ${dark ? "bg-gray-800" : "bg-white"} ${soldOut ? "opacity-60" : ""}`}>
                    {item.image_url ? (
                      <div className="relative h-36">
                        <Image src={item.image_url} alt={item.name_ko} fill className="object-cover" />
                        {soldOut && <div className="absolute inset-0 bg-black/50 flex items-center justify-center"><span className="text-white font-bold text-xs bg-red-500 px-2 py-0.5 rounded-full">{tr.soldOut}</span></div>}
                      </div>
                    ) : (
                      <div className={`h-28 flex items-center justify-center text-4xl relative ${dark ? "bg-gray-700" : "bg-gradient-to-br from-kakao-yellow/30 to-kakao-yellow/10"}`}>
                        🍽️
                        {soldOut && <div className="absolute inset-0 bg-black/40 flex items-center justify-center"><span className="text-white font-bold text-xs bg-red-500 px-2 py-0.5 rounded-full">{tr.soldOut}</span></div>}
                      </div>
                    )}
                    <div className="p-3">
                      <p className={`font-semibold text-sm leading-tight ${dark ? "text-white" : "text-gray-800"}`}>
                        {lang === "ko" ? item.name_ko : item.name_en}
                      </p>
                      {(item.description_ko || item.description_en) && (
                        <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">
                          {lang === "ko" ? item.description_ko : item.description_en}
                        </p>
                      )}
                      <div className="flex items-center justify-between mt-2.5">
                        <span className="font-black text-kakao-brown">{tr.won}{item.price.toLocaleString()}</span>
                        {soldOut ? (
                          <span className="text-xs text-gray-400">{tr.soldOut}</span>
                        ) : inCart ? (
                          <div className="flex items-center gap-1.5">
                            <button onClick={() => changeQty(item.id, -1)} className={`w-7 h-7 rounded-full border-2 flex items-center justify-center font-bold ${dark ? "border-gray-600 text-gray-300" : "border-gray-200 text-gray-600"}`}>−</button>
                            <span className="font-black text-base w-5 text-center">{inCart.quantity}</span>
                            <button onClick={() => addToCart(item)} className="w-7 h-7 rounded-full bg-kakao-yellow flex items-center justify-center font-bold text-kakao-brown">+</button>
                          </div>
                        ) : (
                          <button onClick={() => addToCart(item)} className="bg-kakao-yellow text-kakao-brown font-bold px-3 py-1.5 rounded-xl text-xs active:scale-95 transition-transform">
                            {tr.add}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* TAB: CALL STAFF */}
          {tab === "call" && (
            <div className="p-4 pb-6">
              <h2 className={`font-black text-xl mb-4 ${dark ? "text-white" : "text-gray-800"}`}>🔔 {tr.call}</h2>
              <div className="grid grid-cols-2 gap-2 mb-5">
                {QUICK[lang].map(q => (
                  <button key={q} onClick={() => setCallMsg(q)}
                    className={`py-3.5 px-3 rounded-2xl text-sm font-semibold text-left transition-all active:scale-95 ${callMsg === q ? "bg-kakao-yellow text-kakao-brown" : dark ? "bg-gray-800 text-gray-300" : "bg-white text-gray-700 shadow-sm"}`}>
                    {q}
                  </button>
                ))}
              </div>
              <div className={`rounded-2xl p-4 ${dark ? "bg-gray-800" : "bg-white shadow-sm"}`}>
                <p className={`text-xs font-bold mb-2 ${dark ? "text-gray-400" : "text-gray-500"}`}>직접 입력</p>
                <textarea value={callMsg} onChange={e => setCallMsg(e.target.value)}
                  placeholder={tr.callPlaceholder} rows={3}
                  className={`w-full rounded-xl p-3 text-sm resize-none focus:outline-none ${dark ? "bg-gray-700 text-white placeholder-gray-500" : "bg-gray-50 text-gray-800 border border-gray-100"}`} />
                <button onClick={sendCall} disabled={!callMsg.trim() || callSent}
                  className="w-full mt-3 bg-kakao-yellow text-kakao-brown font-black py-3.5 rounded-2xl disabled:opacity-50 active:scale-95 transition-all">
                  {callSent ? "✓ " + tr.requestSent : tr.send}
                </button>
              </div>
            </div>
          )}

          {/* TAB: MY ORDER */}
          {tab === "order" && (
            <div className="p-4 pb-6">

              {/* Payment celebration */}
              {justPaid && (
                <div className="mb-5 bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-900/50 rounded-3xl p-6 text-center">
                  <div className="text-5xl mb-3">🎉</div>
                  <p className="font-black text-xl text-green-700 dark:text-green-300">{tr.paidTitle}</p>
                  <p className="text-sm text-green-600 dark:text-green-400 mt-1">{tr.paidSub}</p>
                  <button onClick={() => { setJustPaid(false); setTab("menu"); }}
                    className="mt-4 bg-kakao-yellow text-kakao-brown font-bold px-5 py-2.5 rounded-xl text-sm">
                    {tr.menu} →
                  </button>
                </div>
              )}

              {!justPaid && (
                <h2 className={`font-black text-xl mb-4 ${dark ? "text-white" : "text-gray-800"}`}>📋 {tr.myOrder}</h2>
              )}

              {/* Summary cards */}
              {orderItems.length > 0 && (
                <div className="grid grid-cols-3 gap-2.5 mb-5">
                  <div className="bg-orange-50 dark:bg-orange-950/40 rounded-2xl p-3.5 text-center">
                    <p className="text-3xl font-black text-orange-500">{pendingCount}</p>
                    <p className="text-xs text-orange-400 mt-1 font-medium">{tr.preparing}</p>
                  </div>
                  <div className="bg-green-50 dark:bg-green-950/40 rounded-2xl p-3.5 text-center">
                    <p className="text-3xl font-black text-green-500">{doneCount}</p>
                    <p className="text-xs text-green-400 mt-1 font-medium">{tr.ready}</p>
                  </div>
                  <div className={`rounded-2xl p-3.5 text-center ${dark ? "bg-gray-800" : "bg-white shadow-sm"}`}>
                    <p className="text-base font-black text-kakao-brown leading-tight">{tr.won}{orderTotal.toLocaleString()}</p>
                    <p className={`text-xs mt-1 font-medium ${dark ? "text-gray-400" : "text-gray-500"}`}>{tr.total}</p>
                  </div>
                </div>
              )}

              {orderItems.length === 0 && !justPaid ? (
                <div className="py-16 text-center text-gray-400 dark:text-gray-600">
                  <p className="text-4xl mb-3">🍽️</p>
                  <p className="text-sm">{tr.noOrders}</p>
                  <button onClick={() => setTab("menu")}
                    className="mt-4 bg-kakao-yellow text-kakao-brown font-bold px-5 py-2.5 rounded-xl text-sm">
                    {tr.menu} →
                  </button>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {[...orderItems]
                    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
                    .map(item => (
                      <div key={item.id} className={`flex items-center gap-3.5 p-4 rounded-2xl ${item.is_completed ? (dark ? "bg-green-950/30 border border-green-900/50" : "bg-green-50 border border-green-100") : (dark ? "bg-orange-950/30 border border-orange-900/50" : "bg-orange-50 border border-orange-100")}`}>
                        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-xl flex-shrink-0 ${item.is_completed ? "bg-green-100 dark:bg-green-900/60" : "bg-orange-100 dark:bg-orange-900/60"}`}>
                          {item.is_completed ? "✅" : "⏳"}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`font-semibold text-sm ${item.is_completed ? "text-green-700 dark:text-green-300" : "text-orange-700 dark:text-orange-300"}`}>
                            {lang === "ko" ? item.name_ko : item.name_en}
                          </p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            ×{item.quantity} · {tr.won}{(item.price * item.quantity).toLocaleString()}
                          </p>
                        </div>
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-xl flex-shrink-0 ${item.is_completed ? "bg-green-200 dark:bg-green-800/60 text-green-700 dark:text-green-300" : "bg-orange-200 dark:bg-orange-800/60 text-orange-700 dark:text-orange-300"}`}>
                          {item.is_completed ? tr.ready : tr.preparing}
                        </span>
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── CART FLOATING BAR ── */}
      {cartCount > 0 && tab === "menu" && (
        <div className="flex-shrink-0 px-4 py-2 max-w-lg mx-auto w-full">
          <button onClick={() => setShowCart(true)}
            className="w-full bg-kakao-yellow text-kakao-brown font-black py-3.5 rounded-2xl flex items-center justify-between px-5 shadow-lg active:scale-95 transition-transform">
            <span className="flex items-center gap-2">
              <span className="bg-kakao-brown text-white text-xs rounded-full w-6 h-6 flex items-center justify-center font-bold">{cartCount}</span>
              {tr.cart}
            </span>
            <span>{tr.won}{cartTotal.toLocaleString()}</span>
          </button>
        </div>
      )}

      {/* ── BOTTOM NAVBAR — always visible ── */}
      <div className={`flex-shrink-0 border-t ${dark ? "bg-gray-900 border-gray-800" : "bg-white border-gray-200"}`}
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        <div className="max-w-lg mx-auto grid grid-cols-3">
          {([
            { key: "menu", icon: "🍽️", label: tr.menu },
            { key: "call", icon: "🔔", label: tr.call },
            { key: "order", icon: "📋", label: tr.myOrder },
          ] as { key: Tab; icon: string; label: string }[]).map(item => (
            <button key={item.key} onClick={() => setTab(item.key)}
              className={`flex flex-col items-center py-3 gap-0.5 relative transition-colors ${tab === item.key ? "text-kakao-brown" : dark ? "text-gray-600" : "text-gray-400"}`}>
              {tab === item.key && (
                <span className="absolute top-0 left-1/4 right-1/4 h-0.5 bg-kakao-yellow rounded-full" />
              )}
              <span className="text-2xl">{item.icon}</span>
              <span className={`text-xs font-semibold ${tab === item.key ? "text-kakao-brown" : ""}`}>{item.label}</span>
              {item.key === "order" && pendingCount > 0 && (
                <span className="absolute top-2 right-6 w-4 h-4 bg-red-500 text-white text-[9px] rounded-full flex items-center justify-center font-bold">{pendingCount}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── CART MODAL ── */}
      {showCart && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowCart(false)} />
          <div className={`relative w-full max-w-lg rounded-t-3xl shadow-2xl max-h-[85vh] flex flex-col ${dark ? "bg-gray-900" : "bg-white"}`}>
            <div className={`flex items-center justify-between px-5 pt-5 pb-3 border-b ${dark ? "border-gray-800" : "border-gray-100"}`}>
              <h2 className="text-lg font-black">{tr.cart}</h2>
              <button onClick={() => setShowCart(false)} className="text-gray-400 text-3xl leading-none">×</button>
            </div>
            <div className="flex-1 overflow-y-auto px-5">
              {cart.length === 0 ? (
                <p className="text-center text-gray-400 py-12">{tr.empty}</p>
              ) : cart.map(item => (
                <div key={item.menu_item_id} className={`flex items-center justify-between py-4 border-b last:border-0 ${dark ? "border-gray-800" : "border-gray-50"}`}>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm">{lang === "ko" ? item.name_ko : item.name_en}</p>
                    <p className="text-xs text-kakao-brown font-bold mt-0.5">{tr.won}{(item.price * item.quantity).toLocaleString()}</p>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <button onClick={() => changeQty(item.menu_item_id, -1)} className={`w-8 h-8 rounded-full border-2 flex items-center justify-center font-bold ${dark ? "border-gray-700 text-gray-300" : "border-gray-200 text-gray-600"}`}>−</button>
                    <span className="w-6 text-center font-black text-base">{item.quantity}</span>
                    <button onClick={() => changeQty(item.menu_item_id, 1)} className="w-8 h-8 rounded-full bg-kakao-yellow flex items-center justify-center font-bold text-kakao-brown">+</button>
                  </div>
                </div>
              ))}
            </div>
            {cart.length > 0 && (
              <div className={`px-5 py-4 border-t ${dark ? "border-gray-800" : "border-gray-100"}`}>
                <div className="flex justify-between mb-4">
                  <span className="text-gray-400 font-medium">{tr.total}</span>
                  <span className="font-black text-xl text-kakao-brown">{tr.won}{cartTotal.toLocaleString()}</span>
                </div>
                <button onClick={placeOrder} disabled={ordering}
                  className="w-full bg-kakao-yellow text-kakao-brown font-black py-4 rounded-2xl text-base disabled:opacity-60 active:scale-95 transition-transform">
                  {ordering ? "..." : `${tr.order} →`}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TOAST ── */}
      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-gray-900 dark:bg-gray-700 text-white px-5 py-3 rounded-2xl text-sm font-bold shadow-xl whitespace-nowrap">
          {toast}
        </div>
      )}
    </div>
  );
}
