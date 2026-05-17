"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const login = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (res.ok) {
        router.push("/admin");
      } else {
        const data = await res.json();
        setError(data.error || "로그인 실패");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-kakao-dark flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-kakao-yellow rounded-3xl mb-4 shadow-lg">
            <span className="text-4xl">🍽️</span>
          </div>
          <h1 className="text-white text-2xl font-bold">관리자 로그인</h1>
          <p className="text-gray-400 text-sm mt-1">Admin Panel</p>
        </div>

        {/* Form */}
        <form onSubmit={login} className="space-y-3">
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="아이디"
            required
            className="w-full bg-white/10 text-white placeholder-gray-500 border border-white/10 rounded-2xl px-4 py-4 focus:outline-none focus:border-kakao-yellow transition-colors"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="비밀번호"
            required
            className="w-full bg-white/10 text-white placeholder-gray-500 border border-white/10 rounded-2xl px-4 py-4 focus:outline-none focus:border-kakao-yellow transition-colors"
          />

          {error && (
            <p className="text-red-400 text-sm text-center bg-red-400/10 py-2 rounded-xl">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-kakao-yellow text-kakao-brown font-bold py-4 rounded-2xl text-base shadow-md disabled:opacity-60 transition-opacity mt-2"
          >
            {loading ? "로그인 중..." : "로그인"}
          </button>
        </form>

        <p className="text-center text-gray-600 text-xs mt-6">
          처음 사용 시:{" "}
          <a href="/admin/setup" className="text-kakao-yellow underline">
            관리자 계정 만들기
          </a>
        </p>
      </div>
    </div>
  );
}
