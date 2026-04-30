import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { isStaffRole } from "@/lib/staff-auth";

export type ApiActor = {
  id: string;
  lineId: string;
  role: string;
};

export async function getApiActor(): Promise<ApiActor | null> {
  const session = await getServerSession(authOptions);
  const user = session?.user as
    | { id?: string; lineId?: string; role?: string }
    | undefined;

  if (!user) {
    return null;
  }

  const id = String(user.id || "").trim();
  const lineId = String(user.lineId || id || "").trim();
  const role = String(user.role || "").trim().toLowerCase();

  if (!id) {
    return null;
  }

  return {
    id,
    lineId,
    role,
  };
}

export async function requireAdminActor() {
  const actor = await getApiActor();

  if (!actor) {
    return {
      actor: null,
      error: NextResponse.json({ error: "unauthorized" }, { status: 401 }),
    };
  }

  if (actor.role !== "admin") {
    return {
      actor: null,
      error: NextResponse.json({ error: "forbidden" }, { status: 403 }),
    };
  }

  return { actor, error: null };
}

export async function requireStaffActor() {
  const actor = await getApiActor();

  if (!actor) {
    return {
      actor: null,
      error: NextResponse.json({ error: "unauthorized" }, { status: 401 }),
    };
  }

  if (!isStaffRole(actor.role)) {
    return {
      actor: null,
      error: NextResponse.json({ error: "forbidden" }, { status: 403 }),
    };
  }

  return { actor, error: null };
}

export async function requireAdminApi() {
  const { error } = await requireAdminActor();
  return error;
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
