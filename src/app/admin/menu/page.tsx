"use client";

import { useEffect, useState } from "react";
import { Category, MenuItem } from "@/lib/supabase";

export default function MenuPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<(MenuItem & { categories?: Category })[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [showAddItem, setShowAddItem] = useState(false);
  const [editItem, setEditItem] = useState<MenuItem | null>(null);
  const [form, setForm] = useState({
    name_ko: "",
    name_en: "",
    price: "",
    description_ko: "",
    description_en: "",
    image_url: "",
    category_id: "",
    staff_type: "kitchen" as "kitchen" | "hall",
    sort_order: "0",
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    const [catRes, itemRes] = await Promise.all([
      fetch("/api/categories"),
      fetch("/api/menu"),
    ]);
    const [cats, menuItems] = await Promise.all([catRes.json(), itemRes.json()]);
    if (Array.isArray(cats)) setCategories(cats);
    if (Array.isArray(menuItems)) setItems(menuItems);
    setLoading(false);
  };

  const resetForm = () => {
    setForm({
      name_ko: "",
      name_en: "",
      price: "",
      description_ko: "",
      description_en: "",
      image_url: "",
      category_id: categories[0]?.id || "",
      staff_type: "kitchen",
      sort_order: "0",
    });
    setEditItem(null);
    setShowAddItem(false);
  };

  const openEdit = (item: MenuItem) => {
    setEditItem(item);
    setForm({
      name_ko: item.name_ko,
      name_en: item.name_en,
      price: String(item.price),
      description_ko: item.description_ko || "",
      description_en: item.description_en || "",
      image_url: item.image_url || "",
      category_id: item.category_id || "",
      staff_type: item.staff_type,
      sort_order: String(item.sort_order || 0),
    });
    setShowAddItem(true);
  };

  const submitItem = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      ...form,
      price: parseInt(form.price),
      sort_order: parseInt(form.sort_order),
    };

    if (editItem) {
      await fetch(`/api/menu/${editItem.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } else {
      await fetch("/api/menu", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    }
    resetForm();
    loadAll();
  };

  const deleteItem = async (id: string) => {
    if (!confirm("메뉴를 삭제하시겠습니까?")) return;
    await fetch(`/api/menu/${id}`, { method: "DELETE" });
    loadAll();
  };

  const filtered =
    selectedCategory === "all"
      ? items
      : items.filter((i) => i.category_id === selectedCategory);

  return (
    <div className="sm:ml-56 p-4 pb-24 sm:pb-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold text-gray-800">메뉴 관리</h1>
          <button
            onClick={() => { setShowAddItem(true); setEditItem(null); }}
            className="bg-kakao-yellow text-kakao-brown font-bold px-4 py-2 rounded-xl text-sm"
          >
            + 메뉴 추가
          </button>
        </div>

        {/* Category filter tabs */}
        <div className="flex overflow-x-auto scrollbar-hide gap-2 mb-4">
          <button
            onClick={() => setSelectedCategory("all")}
            className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-all ${selectedCategory === "all" ? "bg-kakao-yellow text-kakao-brown font-bold" : "bg-white text-gray-500 shadow-sm"}`}
          >
            전체
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-all ${selectedCategory === cat.id ? "bg-kakao-yellow text-kakao-brown font-bold" : "bg-white text-gray-500 shadow-sm"}`}
            >
              {cat.name_ko}
              <span className="ml-1 text-xs opacity-60">
                {cat.staff_type === "kitchen" ? "🍳" : "🍺"}
              </span>
            </button>
          ))}
        </div>

        {/* Add/Edit Form */}
        {showAddItem && (
          <form
            onSubmit={submitItem}
            className="bg-white rounded-2xl p-4 mb-4 shadow-sm border-2 border-kakao-yellow space-y-3"
          >
            <p className="font-bold text-gray-800">
              {editItem ? "메뉴 수정" : "새 메뉴 추가"}
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">메뉴명 (한국어) *</label>
                <input
                  value={form.name_ko}
                  onChange={(e) => setForm({ ...form, name_ko: e.target.value })}
                  placeholder="된장찌개"
                  required
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-kakao-yellow"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Menu Name (English)</label>
                <input
                  value={form.name_en}
                  onChange={(e) => setForm({ ...form, name_en: e.target.value })}
                  placeholder="Doenjang Jjigae"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-kakao-yellow"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">가격 (원) *</label>
                <input
                  type="number"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                  placeholder="9000"
                  required
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-kakao-yellow"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">순서</label>
                <input
                  type="number"
                  value={form.sort_order}
                  onChange={(e) => setForm({ ...form, sort_order: e.target.value })}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-kakao-yellow"
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">카테고리</label>
              <select
                value={form.category_id}
                onChange={(e) => {
                  const cat = categories.find((c) => c.id === e.target.value);
                  setForm({
                    ...form,
                    category_id: e.target.value,
                    staff_type: cat?.staff_type || "kitchen",
                  });
                }}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-kakao-yellow bg-white"
              >
                <option value="">카테고리 선택</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name_ko} ({cat.staff_type === "kitchen" ? "주방" : "홀"})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">담당 파트</label>
              <div className="flex gap-2">
                {(["kitchen", "hall"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setForm({ ...form, staff_type: t })}
                    className={`flex-1 py-2 rounded-xl text-sm font-bold border transition-all ${form.staff_type === t ? "bg-kakao-yellow border-kakao-yellow text-kakao-brown" : "border-gray-200 text-gray-500"}`}
                  >
                    {t === "kitchen" ? "🍳 주방" : "🍺 홀"}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">설명 (한국어)</label>
              <input
                value={form.description_ko}
                onChange={(e) => setForm({ ...form, description_ko: e.target.value })}
                placeholder="맛있는 된장찌개"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-kakao-yellow"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Description (English)</label>
              <input
                value={form.description_en}
                onChange={(e) => setForm({ ...form, description_en: e.target.value })}
                placeholder="Delicious Korean soybean paste stew"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-kakao-yellow"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">이미지 URL</label>
              <input
                value={form.image_url}
                onChange={(e) => setForm({ ...form, image_url: e.target.value })}
                placeholder="https://..."
                type="url"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-kakao-yellow"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={resetForm}
                className="flex-1 py-2 border border-gray-200 rounded-xl text-sm text-gray-500"
              >
                취소
              </button>
              <button
                type="submit"
                className="flex-1 py-2 bg-kakao-yellow text-kakao-brown font-bold rounded-xl text-sm"
              >
                {editItem ? "수정" : "추가"}
              </button>
            </div>
          </form>
        )}

        {/* Items List */}
        {loading ? (
          <p className="text-center text-gray-400 py-8">로딩 중...</p>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center text-gray-400">
            <p className="text-3xl mb-2">📋</p>
            <p>메뉴가 없습니다</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((item) => (
              <div
                key={item.id}
                className="bg-white rounded-2xl p-4 shadow-sm flex items-center gap-3"
              >
                <div className="w-12 h-12 bg-kakao-yellow/30 rounded-xl flex items-center justify-center text-xl flex-shrink-0">
                  {item.staff_type === "kitchen" ? "🍳" : "🍺"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-gray-800 text-sm truncate">
                      {item.name_ko}
                    </p>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${item.staff_type === "kitchen" ? "bg-red-100 text-red-600" : "bg-blue-100 text-blue-600"}`}
                    >
                      {item.staff_type === "kitchen" ? "주방" : "홀"}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400">{item.name_en}</p>
                  <p className="text-sm font-bold text-kakao-brown mt-0.5">
                    ₩{item.price.toLocaleString()}
                  </p>
                </div>
                <div className="flex flex-col gap-1.5 flex-shrink-0">
                  <button
                    onClick={() => openEdit(item)}
                    className="text-xs bg-gray-100 text-gray-600 px-3 py-1.5 rounded-lg font-medium"
                  >
                    수정
                  </button>
                  <button
                    onClick={() => deleteItem(item.id)}
                    className="text-xs text-red-400 px-3 py-1.5 rounded-lg hover:bg-red-50"
                  >
                    삭제
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
