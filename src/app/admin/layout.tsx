import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/auth";
import AdminNav from "@/components/admin/AdminNav";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Setup page doesn't need auth
  return (
    <div className="min-h-screen bg-gray-50">
      <AdminNav />
      <main className="pt-14">{children}</main>
    </div>
  );
}
