import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { ReactNode } from "react";
import { authOptions } from "@/lib/auth";
import { isAdminRole } from "@/lib/staff-auth";
import AdminSidebar from "./AdminSidebar";

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/");
  }

  if (!isAdminRole(session.user.role)) {
    redirect("/");
  }

  return (
    <div className="min-h-[var(--app-shell-height)] bg-[#050608] text-white">
      <div className="mx-auto flex min-h-[var(--app-shell-height)] max-w-[1800px] flex-col xl:flex-row xl:items-stretch">
        <AdminSidebar />
        <main className="min-w-0 flex-1 px-3 pb-8 pt-4 sm:px-4 lg:px-5 xl:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
