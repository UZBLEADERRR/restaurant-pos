"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Table } from "@/lib/supabase";

export default function TablesPage() {
  const [tables, setTables] = useState<Table[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ number: "", name: "", capacity: "4" });
  const [qrModal, setQrModal] = useState<{ table: Table; qr: string; url: string } | null>(null);
  const [restaurantId, setRestaurantId] = useState("");
  const [appUrl, setAppUrl] = useState("");

  useEffect(() => {
    setAppUrl(window.location.origin);
    // Get current admin's restaurant ID
    fetch("/api/auth/me").then(r => r.json()).then(d => {
      if (d.id) setRestaurantId(d.id);
    });
    loadTables();
  }, []);

  const loadTables = async () => {
    const res = await fetch("/api/tables");
    const data = await res.json();
    if (Array.isArray(data)) setTables(data);
    setLoading(false);
  };

  const addTable = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch("/api/tables", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        number: parseInt(form.number),
        name: form.name || `${form.number}번 테이블`,
        capacity: parseInt(form.capacity),
      }),
    });
    setForm({ number: "", name: "", capacity: "4" });
    setShowAdd(false);
    loadTables();
  };

  const deleteTable = async (id: string) => {
    if (!confirm("테이블을 삭제하시겠습니까?")) return;
    await fetch(`/api/tables/${id}`, { method: "DELETE" });
    loadTables();
  };

  const generateQR = async (table: Table) => {
    const url = restaurantId
      ? `${appUrl}/r/${restaurantId}/table/${table.number}`
      : `${appUrl}/table/${table.number}`;
    const qrDataUrl = await QRCode.toDataURL(url, {
      width: 400, margin: 2, color: { dark: "#111111", light: "#FFFFFF" },
    });
    setQrModal({ table, qr: qrDataUrl, url });
  };

  const downloadQR = () => {
    if (!qrModal) return;
    const a = document.createElement("a");
    a.href = qrModal.qr;
    a.download = `table-${qrModal.table.number}-qr.png`;
    a.click();
  };

  const printQR = () => {
    if (!qrModal) return;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`
      <html>
        <head><title>${qrModal.table.name} QR</title></head>
        <body style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;font-family:sans-serif;background:#fff;">
          <h2 style="font-size:28px;margin-bottom:8px;color:#3C1E1E;">${qrModal.table.name}</h2>
          <p style="color:#888;margin-bottom:20px;font-size:14px;">스캔하여 주문하기 / Scan to order</p>
          <img src="${qrModal.qr}" style="width:280px;height:280px;" />
          <p style="margin-top:16px;color:#ccc;font-size:11px;">${qrModal.url}</p>
          <script>window.onload=()=>window.print();<\/script>
        </body>
      </html>
    `);
  };

  return (
    <div className="sm:ml-56 p-4 pb-24 sm:pb-4 dark:bg-gray-950 min-h-screen">
      <div className="max-w-2xl mx-auto">
        {/* Restaurant URL info */}
        {restaurantId && (
          <div className="bg-kakao-yellow/20 dark:bg-yellow-900/20 border border-kakao-yellow/40 rounded-2xl p-3 mb-4">
            <p className="text-xs font-bold text-kakao-brown dark:text-kakao-yellow mb-1">🔗 내 레스토랑 QR 베이스 URL</p>
            <p className="text-xs text-gray-600 dark:text-gray-400 font-mono break-all">
              {appUrl}/r/<span className="text-kakao-brown dark:text-kakao-yellow font-bold">{restaurantId}</span>/table/[번호]
            </p>
          </div>
        )}

        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold text-gray-800 dark:text-white">테이블 관리</h1>
          <button
            onClick={() => setShowAdd(true)}
            className="bg-kakao-yellow text-kakao-brown font-bold px-4 py-2 rounded-xl text-sm"
          >
            + 추가
          </button>
        </div>

        {showAdd && (
          <form onSubmit={addTable} className="bg-white dark:bg-gray-900 rounded-2xl p-4 mb-4 shadow-sm border-2 border-kakao-yellow space-y-3">
            <p className="font-bold text-gray-800 dark:text-white">새 테이블</p>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-xs text-gray-500 mb-1 block">번호 *</label>
                <input type="number" value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value })}
                  placeholder="5" required className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-kakao-yellow" />
              </div>
              <div className="flex-1">
                <label className="text-xs text-gray-500 mb-1 block">인원</label>
                <input type="number" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })}
                  min="1" className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-kakao-yellow" />
              </div>
            </div>
            <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder={`이름 (예: 창가 ${form.number}번)`}
              className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-kakao-yellow" />
            <div className="flex gap-2">
              <button type="button" onClick={() => setShowAdd(false)} className="flex-1 py-2 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-500">취소</button>
              <button type="submit" className="flex-1 py-2 bg-kakao-yellow text-kakao-brown font-bold rounded-xl text-sm">추가</button>
            </div>
          </form>
        )}

        {loading ? (
          <p className="text-center text-gray-400 py-8">로딩 중...</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {tables.map((table) => (
              <div key={table.id} className="bg-white dark:bg-gray-900 rounded-2xl p-4 shadow-sm text-center">
                <div className="w-12 h-12 bg-kakao-yellow rounded-2xl flex items-center justify-center text-xl font-black text-kakao-brown mx-auto mb-2">
                  {table.number}
                </div>
                <p className="font-bold text-gray-800 dark:text-white text-sm">{table.name}</p>
                <p className="text-xs text-gray-400 mb-3">👤 {table.capacity}명</p>
                <div className="flex flex-col gap-1.5">
                  <button onClick={() => generateQR(table)} className="w-full bg-kakao-yellow text-kakao-brown text-xs font-bold py-2 rounded-xl">
                    📱 QR 코드
                  </button>
                  <a href={restaurantId ? `/r/${restaurantId}/table/${table.number}` : `/table/${table.number}`}
                    target="_blank" className="w-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 text-xs font-medium py-2 rounded-xl block">
                    🔗 링크
                  </a>
                  <button onClick={() => deleteTable(table.id)} className="text-red-400 text-xs py-1">삭제</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* QR Modal */}
      {qrModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setQrModal(null)} />
          <div className="relative bg-white dark:bg-gray-900 rounded-3xl p-6 shadow-2xl text-center w-full max-w-xs">
            <h2 className="text-lg font-bold text-gray-800 dark:text-white mb-1">{qrModal.table.name}</h2>
            <p className="text-xs text-gray-400 mb-4 break-all">{qrModal.url}</p>
            <div className="bg-gray-50 dark:bg-white rounded-2xl p-4 mb-4 inline-block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrModal.qr} alt="QR" className="w-48 h-48" />
            </div>
            <div className="flex gap-2">
              <button onClick={downloadQR} className="flex-1 bg-kakao-yellow text-kakao-brown font-bold py-3 rounded-2xl text-sm">💾 다운</button>
              <button onClick={printQR} className="flex-1 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-bold py-3 rounded-2xl text-sm">🖨️ 인쇄</button>
            </div>
            <button onClick={() => setQrModal(null)} className="mt-3 text-gray-400 text-sm w-full">닫기</button>
          </div>
        </div>
      )}
    </div>
  );
}
