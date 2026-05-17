"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SetupPage() {
  const [form, setForm] = useState({
    username: "",
    password: "",
    setupKey: "setup-restaurant-2024",
  });
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/auth/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (res.ok) {
        setMsg("✅ 관리자 계정이 생성되었습니다!");
        setTimeout(() => router.push("/admin/login"), 2000);
      } else {
        setMsg(`❌ ${data.error}`);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-kakao-dark flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-kakao-yellow rounded-3xl mb-4">
            <span className="text-4xl">⚙️</span>
          </div>
          <h1 className="text-white text-2xl font-bold">초기 설정</h1>
          <p className="text-gray-400 text-sm mt-1">관리자 계정 생성</p>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <input
            type="text"
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
            placeholder="관리자 아이디"
            required
            className="w-full bg-white/10 text-white placeholder-gray-500 border border-white/10 rounded-2xl px-4 py-4 focus:outline-none focus:border-kakao-yellow"
          />
          <input
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            placeholder="비밀번호"
            required
            className="w-full bg-white/10 text-white placeholder-gray-500 border border-white/10 rounded-2xl px-4 py-4 focus:outline-none focus:border-kakao-yellow"
          />
          <input
            type="text"
            value={form.setupKey}
            onChange={(e) => setForm({ ...form, setupKey: e.target.value })}
            placeholder="설정 키"
            required
            className="w-full bg-white/10 text-white placeholder-gray-500 border border-white/10 rounded-2xl px-4 py-4 focus:outline-none focus:border-kakao-yellow"
          />
          {msg && (
            <p className="text-sm text-center py-2 px-3 bg-white/10 rounded-xl text-white">
              {msg}
            </p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-kakao-yellow text-kakao-brown font-bold py-4 rounded-2xl disabled:opacity-60"
          >
            {loading ? "처리 중..." : "계정 생성"}
          </button>
        </form>
      </div>
    </div>
  );
}
