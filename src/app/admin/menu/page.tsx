"use client";

import { useEffect, useState, useRef } from "react";
import { Category, MenuItem } from "@/lib/supabase";

export default function MenuPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<(MenuItem & { is_sold_out?: boolean })[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [showAddItem, setShowAddItem] = useState(false);
  const [editItem, setEditItem] = useState<(MenuItem & { is_sold_out?: boolean }) | null>(null);
  const [form, setForm] = useState({
    name_ko: "", name_en: "", price: "", description_ko: "", description_en: "",
    image_url: "", category_id: "", staff_type: "kitchen" as "kitchen" | "hall", sort_order: "0",
  });
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    const [catRes, itemRes] = await Promise.all([fetch("/api/categories"), fetch("/api/menu?all=1")]);
    const [cats, menuItems] = await Promise.all([catRes.json(), itemRes.json()]);
    if (Array.isArray(cats)) setCategories(cats);
    if (Array.isArray(menuItems)) setItems(menuItems);
    setLoading(false);
  };

  const resetForm = () => {
    setForm({ name_ko: "", name_en: "", price: "", description_ko: "", description_en: "", image_url: "", category_id: categories[0]?.id || "", staff_type: "kitchen", sort_order: "0" });
    setEditItem(null);
    setShowAddItem(false);
  };

  const openEdit = (item: typeof items[0]) => {
    setEditItem(item);
    setForm({ name_ko: item.name_ko, name_en: item.name_en, price: String(item.price), description_ko: item.description_ko || "", description_en: item.description_en || "", image_url: item.image_url || "", category_id: item.category_id || "", staff_type: item.staff_type, sort_order: String(item.sort_order || 0) });
    setShowAddItem(true);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (data.url) {
        setForm(prev => ({ ...prev, image_url: data.url }));
      } else {
        alert("업로드 실패: " + (data.error || "알 수 없는 오류"));
      }
    } catch {
      alert("업로드 중 오류가 발생했습니다");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const submitItem = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { ...form, price: parseInt(form.price), sort_order: parseInt(form.sort_order) };
    if (editItem) {
      await fetch(`/api/menu/${editItem.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    } else {
      await fetch("/api/menu", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    }
    resetForm();
    loadAll();
  };

  const toggleSoldOut = async (item: typeof items[0]) => {
    await fetch(`/api/menu/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_sold_out: !item.is_sold_out }),
    });
    loadAll();
  };

  const toggleAvailable = async (item: typeof items[0]) => {
    await fetch(`/api/menu/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_available: !item.is_available }),
    });
    loadAll();
  };

  const deleteItem = async (id: string) => {
    if (!confirm("삭제하시겠습니까?")) return;
    await fetch(`/api/menu/${id}`, { method: "DELETE" });
    loadAll();
  };

  const filtered = selectedCategory === "all" ? items : items.filter((i) => i.category_id === selectedCategory);

  return (
    <div className="sm:ml-56 p-4 pb-24 sm:pb-4 dark:bg-gray-950 min-h-screen">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold text-gray-800 dark:text-white">메뉴 관리</h1>
          <button onClick={() => { setShowAddItem(true); setEditItem(null); }}
            className="bg-kakao-yellow text-kakao-brown font-bold px-4 py-2 rounded-xl text-sm">
            + 추가
          </button>
        </div>

        {/* Category tabs */}
        <div className="flex overflow-x-auto scrollbar-hide gap-2 mb-4">
          <button onClick={() => setSelectedCategory("all")}
            className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium ${selectedCategory === "all" ? "bg-kakao-yellow text-kakao-brown" : "bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 shadow-sm"}`}>
            전체
          </button>
          {categories.map((cat) => (
            <button key={cat.id} onClick={() => setSelectedCategory(cat.id)}
              className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium ${selectedCategory === cat.id ? "bg-kakao-yellow text-kakao-brown" : "bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 shadow-sm"}`}>
              {cat.name_ko}
            </button>
          ))}
        </div>

        {/* Add/Edit form */}
        {showAddItem && (
          <form onSubmit={submitItem} className="bg-white dark:bg-gray-900 rounded-2xl p-4 mb-4 shadow-sm border-2 border-kakao-yellow space-y-3">
            <p className="font-bold text-gray-800 dark:text-white">{editItem ? "수정" : "새 메뉴"}</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">이름 (한국어) *</label>
                <input value={form.name_ko} onChange={(e) => setForm({ ...form, name_ko: e.target.value })} placeholder="된장찌개" required
                  className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-kakao-yellow" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Name (EN)</label>
                <input value={form.name_en} onChange={(e) => setForm({ ...form, name_en: e.target.value })} placeholder="Doenjang Jjigae"
                  className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-kakao-yellow" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">가격 *</label>
                <input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="9000" required
                  className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-kakao-yellow" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">순서</label>
                <input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: e.target.value })}
                  className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-kakao-yellow" />
              </div>
            </div>
            <select value={form.category_id} onChange={(e) => {
              const cat = categories.find((c) => c.id === e.target.value);
              setForm({ ...form, category_id: e.target.value, staff_type: cat?.staff_type || "kitchen" });
            }} className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-kakao-yellow bg-white">
              <option value="">카테고리 선택</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.name_ko} ({cat.staff_type === "kitchen" ? "주방" : "홀"})</option>
              ))}
            </select>
            <div className="flex gap-2">
              {(["kitchen", "hall"] as const).map((t) => (
                <button key={t} type="button" onClick={() => setForm({ ...form, staff_type: t })}
                  className={`flex-1 py-2 rounded-xl text-sm font-bold border transition-all ${form.staff_type === t ? "bg-kakao-yellow border-kakao-yellow text-kakao-brown" : "border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400"}`}>
                  {t === "kitchen" ? "🍳 주방" : "🍺 홀"}
                </button>
              ))}
            </div>
            <input value={form.description_ko} onChange={(e) => setForm({ ...form, description_ko: e.target.value })} placeholder="설명 (한국어)"
              className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-kakao-yellow" />

            {/* Image upload section */}
            <div>
              <label className="text-xs text-gray-500 mb-2 block">메뉴 이미지</label>
              <div className="flex gap-2 items-start">
                <div className="flex-1">
                  {form.image_url ? (
                    <div className="relative rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={form.image_url} alt="preview" className="w-full h-32 object-cover" />
                      <button
                        type="button"
                        onClick={() => setForm(prev => ({ ...prev, image_url: "" }))}
                        className="absolute top-2 right-2 w-6 h-6 bg-black/50 text-white rounded-full text-xs flex items-center justify-center hover:bg-black/70"
                      >×</button>
                    </div>
                  ) : (
                    <div
                      onClick={() => fileRef.current?.click()}
                      className="border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl h-24 flex flex-col items-center justify-center cursor-pointer hover:border-kakao-yellow transition-colors"
                    >
                      {uploading ? (
                        <span className="text-xs text-gray-400 animate-pulse">업로드 중...</span>
                      ) : (
                        <>
                          <span className="text-2xl mb-1">📷</span>
                          <span className="text-xs text-gray-400">클릭하여 이미지 업로드</span>
                        </>
                      )}
                    </div>
                  )}
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageUpload}
                  />
                </div>
                {form.image_url && (
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                    className="flex-shrink-0 px-3 py-2 text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-xl disabled:opacity-50"
                  >
                    {uploading ? "업로드 중..." : "변경"}
                  </button>
                )}
              </div>
            </div>

            <div className="flex gap-2">
              <button type="button" onClick={resetForm} className="flex-1 py-2 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-500">취소</button>
              <button type="submit" className="flex-1 py-2 bg-kakao-yellow text-kakao-brown font-bold rounded-xl text-sm">{editItem ? "수정" : "추가"}</button>
            </div>
          </form>
        )}

        {/* Items list */}
        {loading ? <p className="text-center text-gray-400 py-8">로딩 중...</p> : (
          <div className="space-y-2">
            {filtered.map((item) => (
              <div key={item.id} className={`bg-white dark:bg-gray-900 rounded-2xl shadow-sm overflow-hidden ${!item.is_available ? "opacity-50" : ""}`}>
                {item.image_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.image_url} alt={item.name_ko} className="w-full h-32 object-cover" />
                )}
                <div className="flex items-center gap-3 p-4">
                  {!item.image_url && (
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl flex-shrink-0 ${item.is_sold_out ? "bg-red-100 dark:bg-red-900/40" : item.staff_type === "kitchen" ? "bg-yellow-50 dark:bg-yellow-900/20" : "bg-blue-50 dark:bg-blue-900/20"}`}>
                      {item.is_sold_out ? "🚫" : item.staff_type === "kitchen" ? "🍳" : "🍺"}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-gray-800 dark:text-white text-sm">{item.name_ko}</p>
                      {item.is_sold_out && (
                        <span className="text-xs bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 px-2 py-0.5 rounded-full">품절</span>
                      )}
                      {!item.is_available && (
                        <span className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-500 px-2 py-0.5 rounded-full">숨김</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400">{item.name_en}</p>
                    <p className="text-sm font-bold text-kakao-brown mt-0.5">₩{item.price.toLocaleString()}</p>
                  </div>
                  <div className="flex flex-col gap-1.5 flex-shrink-0">
                    <button onClick={() => toggleSoldOut(item)}
                      className={`text-xs px-2.5 py-1.5 rounded-lg font-medium ${item.is_sold_out ? "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400" : "bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400"}`}>
                      {item.is_sold_out ? "재개" : "품절"}
                    </button>
                    <button onClick={() => openEdit(item)} className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 px-2.5 py-1.5 rounded-lg">수정</button>
                    <button onClick={() => deleteItem(item.id)} className="text-xs text-red-400 px-2.5 py-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20">삭제</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
