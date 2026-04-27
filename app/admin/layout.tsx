import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { ReactNode } from "react";
import { authOptions } from "@/lib/auth";
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

  if ((session.user as { role?: string }).role !== "admin") {
    redirect("/");
  }

  return (
    <div className="min-h-screen bg-[#050608] text-white">
      <div className="mx-auto flex min-h-screen max-w-[1800px] xl:items-stretch">
        <AdminSidebar />
        <main className="min-w-0 flex-1 px-3 pb-6 pt-3 sm:px-4 lg:px-5 xl:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
