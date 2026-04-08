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

  if ((session.user as any).role !== "admin") {
    redirect("/");
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        background: "#000",
        color: "#fff",
        fontFamily: "sans-serif",
      }}
    >
      <AdminSidebar />

      <main
        style={{
          flex: 1,
          padding: 24,
          background: "#000",
        }}
      >
        {children}
      </main>
    </div>
  );
}