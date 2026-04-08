"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function AdminSidebar() {
  const pathname = usePathname();

  const menus = [
    { href: "/admin", label: "📊 Dashboard", exact: true },
    { href: "/admin/members", label: "👥 Members" },
    { href: "/admin/rewards", label: "🎁 Rewards" },
    { href: "/admin/coupons", label: "🎟️ Coupons" },
    { href: "/admin/point-logs", label: "⚡ Point Logs" },
    { href: "/staff", label: "➕ Add Point" },
    { href: "/redeem", label: "💳 Redeem" },
    { href: "/staff/scan", label: "📷 Scan Coupon" },
  ];

  return (
    <aside
      style={{
        width: 240,
        background: "#0d0d0d",
        borderRight: "1px solid #1f1f1f",
        padding: 20,
      }}
    >
      <div
        style={{
          fontSize: 22,
          fontWeight: "bold",
          marginBottom: 30,
          color: "#d4af37",
        }}
      >
        NEXORA Admin
      </div>

      <nav style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {menus.map((menu) => {
          const isActive = menu.exact
            ? pathname === menu.href
            : pathname.startsWith(menu.href);

          return (
            <Link
              key={menu.href}
              href={menu.href}
              style={{
                display: "block",
                padding: "12px 14px",
                borderRadius: 10,
                color: isActive ? "#000" : "#fff",
                textDecoration: "none",
                background: isActive ? "#d4af37" : "#151515",
                border: isActive ? "1px solid #d4af37" : "1px solid #222",
                fontWeight: isActive ? "bold" : "normal",
                boxShadow: isActive
                  ? "0 0 0 1px rgba(212,175,55,0.15), 0 8px 20px rgba(212,175,55,0.08)"
                  : "none",
                transition: "all 0.2s ease",
              }}
            >
              {menu.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}