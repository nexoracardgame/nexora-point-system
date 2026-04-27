import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";

export async function requireAdminApi() {
  const session = await getServerSession(authOptions);
  const role = String((session?.user as { role?: string } | undefined)?.role || "");

  if (!session?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  return null;
}

export function sanitizeNullableUrl(value: unknown) {
  const raw = String(value || "").trim();
  if (!raw) return null;

  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

export function toNullableNonNegativeNumber(value: unknown) {
  if (value === null || value === "" || value === undefined) return null;
  const next = Number(value);
  return Number.isFinite(next) && next >= 0 ? next : null;
}

export function toNonNegativeInt(value: unknown, fallback = 0) {
  const next = Number(value);
  if (!Number.isFinite(next) || next < 0) return fallback;
  return Math.floor(next);
}
