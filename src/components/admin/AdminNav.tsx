"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const navItems = [
  { href: "/admin", label: "대시보드", icon: "🏠", exact: true },
  { href: "/admin/tables", label: "테이블", icon: "🪑" },
  { href: "/admin/menu", label: "메뉴", icon: "📋" },
  { href: "/admin/categories", label: "카테고리", icon: "🗂️" },
];

export default function AdminNav() {
  const pathname = usePathname();
  const router = useRouter();

  const isActive = (href: string, exact?: boolean) => {
    if (exact) return pathname === href;
    return pathname.startsWith(href);
  };

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/admin/login");
  };

  // Don't show nav on login/setup pages
  if (pathname === "/admin/login" || pathname === "/admin/setup") return null;

  return (
    <>
      {/* Top bar */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-kakao-dark text-white h-14 flex items-center justify-between px-4 shadow-lg">
        <div className="flex items-center gap-3">
          <span className="text-kakao-yellow font-bold text-lg">🍽️ POS</span>
          <span className="text-gray-500 text-sm hidden sm:block">관리자 패널</span>
        </div>
        <button
          onClick={logout}
          className="text-gray-400 hover:text-white text-sm transition-colors"
        >
          로그아웃
        </button>
      </header>

      {/* Bottom nav for mobile */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-kakao-dark border-t border-white/10 flex sm:hidden">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex-1 flex flex-col items-center py-2 text-xs gap-1 transition-colors ${
              isActive(item.href, item.exact)
                ? "text-kakao-yellow"
                : "text-gray-500"
            }`}
          >
            <span className="text-xl">{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </nav>

      {/* Side nav for desktop */}
      <aside className="fixed left-0 top-14 bottom-0 z-40 w-56 bg-kakao-dark hidden sm:flex flex-col py-4 shadow-xl">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-3 px-5 py-3 text-sm font-medium transition-colors mx-2 rounded-xl ${
              isActive(item.href, item.exact)
                ? "bg-kakao-yellow text-kakao-brown"
                : "text-gray-400 hover:text-white hover:bg-white/5"
            }`}
          >
            <span>{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </aside>
    </>
  );
}
