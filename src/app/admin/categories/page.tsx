"use client";

import { useEffect, useState } from "react";
import { Category } from "@/lib/supabase";

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [editCat, setEditCat] = useState<Category | null>(null);
  const [form, setForm] = useState({
    name_ko: "",
    name_en: "",
    staff_type: "kitchen" as "kitchen" | "hall",
    sort_order: "0",
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    const res = await fetch("/api/categories");
    const data = await res.json();
    if (Array.isArray(data)) setCategories(data);
    setLoading(false);
  };

  const resetForm = () => {
    setForm({ name_ko: "", name_en: "", staff_type: "kitchen", sort_order: "0" });
    setEditCat(null);
    setShowAdd(false);
  };

  const openEdit = (cat: Category) => {
    setEditCat(cat);
    setForm({
      name_ko: cat.name_ko,
      name_en: cat.name_en,
      staff_type: cat.staff_type,
      sort_order: String(cat.sort_order),
    });
    setShowAdd(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { ...form, sort_order: parseInt(form.sort_order) };

    if (editCat) {
      await fetch(`/api/categories/${editCat.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } else {
      await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    }
    resetForm();
    loadCategories();
  };

  const deleteCategory = async (id: string) => {
    if (!confirm("카테고리를 삭제하시겠습니까?")) return;
    await fetch(`/api/categories/${id}`, { method: "DELETE" });
    loadCategories();
  };

  return (
    <div className="sm:ml-56 p-4 pb-24 sm:pb-4">
      <div className="max-w-lg mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold text-gray-800">카테고리 관리</h1>
          <button
            onClick={() => { setShowAdd(true); setEditCat(null); }}
            className="bg-kakao-yellow text-kakao-brown font-bold px-4 py-2 rounded-xl text-sm"
          >
            + 추가
          </button>
        </div>

        {showAdd && (
          <form
            onSubmit={submit}
            className="bg-white rounded-2xl p-4 mb-4 shadow-sm border-2 border-kakao-yellow space-y-3"
          >
            <p className="font-bold text-gray-800">
              {editCat ? "카테고리 수정" : "새 카테고리 추가"}
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">이름 (한국어) *</label>
                <input
                  value={form.name_ko}
                  onChange={(e) => setForm({ ...form, name_ko: e.target.value })}
                  placeholder="메인 요리"
                  required
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-kakao-yellow"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Name (English) *</label>
                <input
                  value={form.name_en}
                  onChange={(e) => setForm({ ...form, name_en: e.target.value })}
                  placeholder="Main Dishes"
                  required
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-kakao-yellow"
                />
              </div>
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
              <label className="text-xs text-gray-500 mb-1 block">순서</label>
              <input
                type="number"
                value={form.sort_order}
                onChange={(e) => setForm({ ...form, sort_order: e.target.value })}
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
                {editCat ? "수정" : "추가"}
              </button>
            </div>
          </form>
        )}

        {loading ? (
          <p className="text-center text-gray-400 py-8">로딩 중...</p>
        ) : categories.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center text-gray-400">
            카테고리가 없습니다
          </div>
        ) : (
          <div className="space-y-2">
            {categories.map((cat) => (
              <div
                key={cat.id}
                className="bg-white rounded-2xl p-4 shadow-sm flex items-center gap-3"
              >
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0 ${cat.staff_type === "kitchen" ? "bg-red-100" : "bg-blue-100"}`}
                >
                  {cat.staff_type === "kitchen" ? "🍳" : "🍺"}
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-gray-800">{cat.name_ko}</p>
                  <p className="text-xs text-gray-400">
                    {cat.name_en} · {cat.staff_type === "kitchen" ? "주방" : "홀"} · 순서 {cat.sort_order}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => openEdit(cat)}
                    className="text-xs bg-gray-100 text-gray-600 px-3 py-1.5 rounded-lg"
                  >
                    수정
                  </button>
                  <button
                    onClick={() => deleteCategory(cat.id)}
                    className="text-xs text-red-400 px-2 py-1.5 rounded-lg hover:bg-red-50"
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
