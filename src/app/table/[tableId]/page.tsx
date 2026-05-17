"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase, Category, MenuItem } from "@/lib/supabase";
import Image from "next/image";

type Lang = "ko" | "en";

type CartItem = {
  menu_item_id: string;
  name_ko: string;
  name_en: string;
  price: number;
  quantity: number;
  staff_type: "kitchen" | "hall";
};

type TableInfo = {
  id: string;
  number: number;
  name: string;
};

const t = {
  ko: {
    title: "주문하기",
    categories: "카테고리",
    cart: "장바구니",
    order: "주문하기",
    request: "요청사항",
    requestPlaceholder: "예: 수저와 포크 가져다 주세요",
    send: "보내기",
    total: "합계",
    empty: "장바구니가 비어있습니다",
    ordered: "주문 완료!",
    orderedMsg: "주문이 접수되었습니다",
    requestSent: "요청이 전송되었습니다",
    add: "담기",
    won: "원",
    close: "닫기",
    requestTitle: "직원에게 요청",
    orderHistory: "주문 내역",
    completed: "완료",
    pending: "대기중",
    kitchen: "주방",
    hall: "홀",
    all: "전체",
  },
  en: {
    title: "Order",
    categories: "Categories",
    cart: "Cart",
    order: "Place Order",
    request: "Request",
    requestPlaceholder: "e.g. Please bring spoons and forks",
    send: "Send",
    total: "Total",
    empty: "Your cart is empty",
    ordered: "Order Placed!",
    orderedMsg: "Your order has been received",
    requestSent: "Request sent!",
    add: "Add",
    won: "₩",
    close: "Close",
    requestTitle: "Request to Staff",
    orderHistory: "Order History",
    completed: "Done",
    pending: "Pending",
    kitchen: "Kitchen",
    hall: "Hall",
    all: "All",
  },
};

export default function TablePage({
  params,
}: {
  params: { tableId: string };
}) {
  const [lang, setLang] = useState<Lang>("ko");
  const [table, setTable] = useState<TableInfo | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCart, setShowCart] = useState(false);
  const [showRequest, setShowRequest] = useState(false);
  const [requestMsg, setRequestMsg] = useState("");
  const [orderId, setOrderId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const tr = t[lang];

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    const loadData = async () => {
      const { data: tableData } = await supabase
        .from("restaurant_tables")
        .select("id, number, name")
        .eq("number", params.tableId)
        .single();

      if (tableData) {
        setTable(tableData);

        // Check for existing active order
        const { data: existingOrder } = await supabase
          .from("orders")
          .select("id")
          .eq("table_id", tableData.id)
          .eq("status", "active")
          .single();

        if (existingOrder) setOrderId(existingOrder.id);
      }

      const { data: cats } = await supabase
        .from("categories")
        .select("*")
        .eq("is_active", true)
        .order("sort_order");

      if (cats) setCategories(cats);

      const { data: items } = await supabase
        .from("menu_items")
        .select("*, categories(*)")
        .eq("is_available", true)
        .order("sort_order");

      if (items) setMenuItems(items);
    };

    loadData();
  }, [params.tableId]);

  const filtered = useCallback(() => {
    if (selectedCategory === "all") return menuItems;
    return menuItems.filter((m) => m.category_id === selectedCategory);
  }, [menuItems, selectedCategory]);

  const addToCart = (item: MenuItem) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.menu_item_id === item.id);
      if (existing) {
        return prev.map((c) =>
          c.menu_item_id === item.id
            ? { ...c, quantity: c.quantity + 1 }
            : c
        );
      }
      return [
        ...prev,
        {
          menu_item_id: item.id,
          name_ko: item.name_ko,
          name_en: item.name_en,
          price: item.price,
          quantity: 1,
          staff_type: item.staff_type,
        },
      ];
    });
  };

  const changeQty = (id: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((c) =>
          c.menu_item_id === id ? { ...c, quantity: c.quantity + delta } : c
        )
        .filter((c) => c.quantity > 0)
    );
  };

  const totalPrice = cart.reduce((s, c) => s + c.price * c.quantity, 0);
  const totalCount = cart.reduce((s, c) => s + c.quantity, 0);

  const placeOrder = async () => {
    if (!table || cart.length === 0) return;
    setLoading(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ table_id: table.id, items: cart }),
      });
      const data = await res.json();
      if (data.order_id) {
        setOrderId(data.order_id);
        setCart([]);
        setShowCart(false);
        showToast(tr.orderedMsg);
      }
    } finally {
      setLoading(false);
    }
  };

  const sendRequest = async () => {
    if (!table || !requestMsg.trim()) return;
    try {
      await fetch("/api/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          table_id: table.id,
          order_id: orderId,
          message: requestMsg.trim(),
        }),
      });
      setRequestMsg("");
      setShowRequest(false);
      showToast(tr.requestSent);
    } catch {}
  };

  const cartItem = (item: CartItem) => (
    <div key={item.menu_item_id} className="flex items-center justify-between py-3 border-b border-kakao-gray-2 last:border-0">
      <div className="flex-1">
        <p className="font-medium text-kakao-dark">
          {lang === "ko" ? item.name_ko : item.name_en}
        </p>
        <p className="text-sm text-kakao-gray-3">
          {tr.won}{item.price.toLocaleString()}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => changeQty(item.menu_item_id, -1)}
          className="w-7 h-7 rounded-full border border-kakao-gray-2 flex items-center justify-center text-kakao-gray-4 hover:bg-kakao-gray"
        >
          −
        </button>
        <span className="w-5 text-center font-bold">{item.quantity}</span>
        <button
          onClick={() => changeQty(item.menu_item_id, 1)}
          className="w-7 h-7 rounded-full bg-kakao-yellow flex items-center justify-center font-bold text-kakao-brown hover:bg-kakao-yellow-dark"
        >
          +
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-kakao-gray font-sans">
      {/* Header */}
      <div className="bg-kakao-yellow sticky top-0 z-40 shadow-sm">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="font-bold text-kakao-brown text-lg">
              {table
                ? lang === "ko"
                  ? table.name
                  : `Table ${table.number}`
                : "..."}
            </h1>
            <p className="text-xs text-kakao-brown opacity-70">{tr.title}</p>
          </div>
          <div className="flex items-center gap-2">
            {/* Language toggle */}
            <div className="flex bg-white rounded-full p-0.5 shadow-sm">
              <button
                onClick={() => setLang("ko")}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${lang === "ko" ? "bg-kakao-brown text-white" : "text-kakao-gray-4"}`}
              >
                한국어
              </button>
              <button
                onClick={() => setLang("en")}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${lang === "en" ? "bg-kakao-brown text-white" : "text-kakao-gray-4"}`}
              >
                EN
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="bg-white border-b border-kakao-gray-2 sticky top-14 z-30">
        <div className="max-w-lg mx-auto">
          <div className="flex overflow-x-auto scrollbar-hide px-4 py-2 gap-2">
            <button
              onClick={() => setSelectedCategory("all")}
              className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-all ${selectedCategory === "all" ? "bg-kakao-yellow text-kakao-brown font-bold" : "bg-kakao-gray text-kakao-gray-4"}`}
            >
              {tr.all}
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-all ${selectedCategory === cat.id ? "bg-kakao-yellow text-kakao-brown font-bold" : "bg-kakao-gray text-kakao-gray-4"}`}
              >
                {lang === "ko" ? cat.name_ko : cat.name_en}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Menu Items */}
      <div className="max-w-lg mx-auto px-4 py-4 pb-36">
        <div className="grid grid-cols-2 gap-3">
          {filtered().map((item) => {
            const inCart = cart.find((c) => c.menu_item_id === item.id);
            return (
              <div
                key={item.id}
                className="bg-white rounded-2xl overflow-hidden shadow-sm active:scale-95 transition-transform"
              >
                {item.image_url ? (
                  <div className="relative h-36">
                    <Image
                      src={item.image_url}
                      alt={item.name_ko}
                      fill
                      className="object-cover"
                    />
                  </div>
                ) : (
                  <div className="h-28 bg-gradient-to-br from-kakao-yellow to-kakao-yellow-dark flex items-center justify-center text-4xl">
                    🍽️
                  </div>
                )}
                <div className="p-3">
                  <p className="font-semibold text-kakao-dark text-sm leading-tight">
                    {lang === "ko" ? item.name_ko : item.name_en}
                  </p>
                  {(lang === "ko" ? item.description_ko : item.description_en) && (
                    <p className="text-xs text-kakao-gray-3 mt-0.5 line-clamp-1">
                      {lang === "ko" ? item.description_ko : item.description_en}
                    </p>
                  )}
                  <div className="flex items-center justify-between mt-2">
                    <span className="font-bold text-kakao-brown text-sm">
                      {tr.won}{item.price.toLocaleString()}
                    </span>
                    {inCart ? (
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => changeQty(item.id, -1)}
                          className="w-6 h-6 rounded-full border border-kakao-gray-2 flex items-center justify-center text-xs"
                        >
                          −
                        </button>
                        <span className="text-sm font-bold w-4 text-center">{inCart.quantity}</span>
                        <button
                          onClick={() => addToCart(item)}
                          className="w-6 h-6 rounded-full bg-kakao-yellow flex items-center justify-center text-xs font-bold"
                        >
                          +
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => addToCart(item)}
                        className="bg-kakao-yellow text-kakao-brown text-xs font-bold px-3 py-1.5 rounded-full hover:bg-kakao-yellow-dark transition-colors"
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

      {/* Bottom Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40">
        <div className="max-w-lg mx-auto px-4 pb-6 pt-3 bg-gradient-to-t from-kakao-gray via-kakao-gray to-transparent">
          <div className="flex gap-2">
            {/* Request button */}
            <button
              onClick={() => setShowRequest(true)}
              className="flex-shrink-0 bg-white border-2 border-kakao-yellow text-kakao-brown font-bold py-3.5 px-4 rounded-2xl text-sm shadow-md"
            >
              📣 {tr.request}
            </button>
            {/* Cart / Order button */}
            <button
              onClick={() => (cart.length > 0 ? setShowCart(true) : null)}
              disabled={cart.length === 0}
              className={`flex-1 py-3.5 px-4 rounded-2xl font-bold text-sm shadow-md transition-all flex items-center justify-between ${cart.length > 0 ? "bg-kakao-yellow text-kakao-brown" : "bg-kakao-gray-2 text-kakao-gray-3 cursor-not-allowed"}`}
            >
              <span>
                {totalCount > 0 && (
                  <span className="bg-kakao-brown text-white text-xs rounded-full px-2 py-0.5 mr-2">
                    {totalCount}
                  </span>
                )}
                {tr.cart}
              </span>
              {totalPrice > 0 && (
                <span>{tr.won}{totalPrice.toLocaleString()}</span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Cart Modal */}
      {showCart && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setShowCart(false)}
          />
          <div className="relative bg-white w-full max-w-lg rounded-t-3xl shadow-2xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-kakao-gray-2">
              <h2 className="text-lg font-bold text-kakao-dark">{tr.cart}</h2>
              <button
                onClick={() => setShowCart(false)}
                className="text-kakao-gray-3 text-2xl leading-none"
              >
                ×
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5">
              {cart.length === 0 ? (
                <p className="text-center text-kakao-gray-3 py-12">{tr.empty}</p>
              ) : (
                cart.map(cartItem)
              )}
            </div>
            {cart.length > 0 && (
              <div className="px-5 py-4 border-t border-kakao-gray-2">
                <div className="flex justify-between mb-4">
                  <span className="font-semibold text-kakao-gray-4">{tr.total}</span>
                  <span className="font-bold text-lg text-kakao-brown">
                    {tr.won}{totalPrice.toLocaleString()}
                  </span>
                </div>
                <button
                  onClick={placeOrder}
                  disabled={loading}
                  className="w-full bg-kakao-yellow text-kakao-brown font-bold py-4 rounded-2xl text-base shadow-md disabled:opacity-60"
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
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setShowRequest(false)}
          />
          <div className="relative bg-white w-full max-w-lg rounded-t-3xl shadow-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-kakao-dark">{tr.requestTitle}</h2>
              <button
                onClick={() => setShowRequest(false)}
                className="text-kakao-gray-3 text-2xl leading-none"
              >
                ×
              </button>
            </div>
            <textarea
              value={requestMsg}
              onChange={(e) => setRequestMsg(e.target.value)}
              placeholder={tr.requestPlaceholder}
              rows={3}
              className="w-full border border-kakao-gray-2 rounded-xl p-3 text-sm resize-none focus:outline-none focus:border-kakao-yellow"
            />
            {/* Quick requests */}
            <div className="flex flex-wrap gap-2 mt-3">
              {(lang === "ko"
                ? ["수저 주세요", "냅킨 주세요", "물 주세요", "포크 주세요", "직원 불러주세요"]
                : ["Chopsticks please", "Napkin please", "Water please", "Fork please", "Call staff"]
              ).map((q) => (
                <button
                  key={q}
                  onClick={() => setRequestMsg(q)}
                  className="text-xs bg-kakao-gray px-3 py-1.5 rounded-full text-kakao-gray-4 hover:bg-kakao-yellow hover:text-kakao-brown transition-colors"
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

      {/* Toast */}
      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-kakao-dark text-white px-5 py-3 rounded-2xl text-sm font-medium shadow-xl animate-bounce">
          {toast}
        </div>
      )}
    </div>
  );
}
