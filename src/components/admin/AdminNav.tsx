"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const navItems = [
  { href: "/admin", label: "대시보드", icon: "🏠", exact: true },
  { href: "/admin/tables", label: "테이블", icon: "🪑" },
  { href: "/admin/menu", label: "메뉴", icon: "📋" },
  { href: "/admin/categories", label: "카테고리", icon: "🗂️" },
];

export default function AdminNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("admin-theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const isDark = saved ? saved === "dark" : prefersDark;
    setDark(isDark);
    document.documentElement.classList.toggle("dark", isDark);
  }, []);

  const toggleDark = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("admin-theme", next ? "dark" : "light");
  };

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname.startsWith(href);

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/admin/login");
  };

  if (pathname === "/admin/login" || pathname === "/admin/setup") return null;

  return (
    <>
      {/* Top bar */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-gray-950 dark:bg-black text-white h-14 flex items-center justify-between px-4 shadow-lg">
        <div className="flex items-center gap-3">
          <span className="text-kakao-yellow font-bold text-lg">🍽️ POS</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={toggleDark}
            className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-base hover:bg-white/20 transition-colors"
            title="다크모드 토글"
          >
            {dark ? "☀️" : "🌙"}
          </button>
          <button onClick={logout} className="text-gray-400 hover:text-white text-sm">
            로그아웃
          </button>
        </div>
      </header>

      {/* Bottom nav (mobile) */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-gray-950 dark:bg-black border-t border-white/10 flex sm:hidden">
        {navItems.map((item) => (
          <Link key={item.href} href={item.href}
            className={`flex-1 flex flex-col items-center py-2 text-xs gap-0.5 transition-colors ${isActive(item.href, item.exact) ? "text-kakao-yellow" : "text-gray-500"}`}>
            <span className="text-xl">{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </nav>

      {/* Side nav (desktop) */}
      <aside className="fixed left-0 top-14 bottom-0 z-40 w-56 bg-gray-950 dark:bg-black hidden sm:flex flex-col py-4 shadow-xl">
        {navItems.map((item) => (
          <Link key={item.href} href={item.href}
            className={`flex items-center gap-3 px-5 py-3 text-sm font-medium transition-colors mx-2 rounded-xl ${isActive(item.href, item.exact) ? "bg-kakao-yellow text-kakao-brown" : "text-gray-400 hover:text-white hover:bg-white/5"}`}>
            <span>{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </aside>
    </>
  );
}
