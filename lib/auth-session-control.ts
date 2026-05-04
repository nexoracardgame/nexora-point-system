import type { NextRequest, NextResponse } from "next/server";
import { AUTH_LINK_COOKIE_NAME } from "@/lib/auth-link-cookie";
import { prisma } from "@/lib/prisma";

let userSessionSchemaReadyPromise: Promise<void> | null = null;

export function getAuthSecret() {
  return String(
    process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET || ""
  ).trim();
}

export async function ensureUserSessionSchema() {
  if (!userSessionSchemaReadyPromise) {
    userSessionSchemaReadyPromise = (async () => {
      await prisma.$executeRawUnsafe(
        'ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "sessionVersion" INTEGER NOT NULL DEFAULT 1'
      );
      await prisma.$executeRawUnsafe(
        'ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "sessionsRevokedAt" TIMESTAMP(3)'
      );
    })();
  }

  return userSessionSchemaReadyPromise;
}

export async function getUserSessionState(userId: string) {
  const safeUserId = String(userId || "").trim();

  if (!safeUserId) {
    return null;
  }

  await ensureUserSessionSchema();

  const rows = await prisma.$queryRawUnsafe<
    Array<{
      sessionVersion?: number | null;
      sessionsRevokedAt?: Date | null;
    }>
  >(
    'SELECT "sessionVersion", "sessionsRevokedAt" FROM "User" WHERE "id" = $1 LIMIT 1',
    safeUserId
  );

  const row = rows[0];

  if (!row) {
    return null;
  }

  return {
    sessionVersion: Math.max(1, Number(row.sessionVersion || 1)),
    sessionsRevokedAt: row.sessionsRevokedAt || null,
  };
}

export async function revokeUserSessions(userId: string) {
  const safeUserId = String(userId || "").trim();

  if (!safeUserId) {
    return null;
  }

  await ensureUserSessionSchema();

  const rows = await prisma.$queryRawUnsafe<
    Array<{
      sessionVersion?: number | null;
      sessionsRevokedAt?: Date | null;
    }>
  >(
    'UPDATE "User" SET "sessionVersion" = COALESCE("sessionVersion", 1) + 1, "sessionsRevokedAt" = NOW() WHERE "id" = $1 RETURNING "sessionVersion", "sessionsRevokedAt"',
    safeUserId
  );

  const row = rows[0];

  return row
    ? {
        sessionVersion: Math.max(1, Number(row.sessionVersion || 1)),
        sessionsRevokedAt: row.sessionsRevokedAt || null,
      }
    : null;
}

export function clearAuthCookies(req: NextRequest, res: NextResponse) {
  const names = new Set([
    "next-auth.session-token",
    "__Secure-next-auth.session-token",
    "next-auth.callback-url",
    "__Secure-next-auth.callback-url",
    "next-auth.csrf-token",
    "__Host-next-auth.csrf-token",
    "next-auth.pkce.code_verifier",
    "__Secure-next-auth.pkce.code_verifier",
    "next-auth.state",
    "__Secure-next-auth.state",
    "next-auth.nonce",
    "__Secure-next-auth.nonce",
    "authjs.session-token",
    "__Secure-authjs.session-token",
    "authjs.callback-url",
    "__Secure-authjs.callback-url",
    "authjs.csrf-token",
    "__Host-authjs.csrf-token",
    AUTH_LINK_COOKIE_NAME,
  ]);

  req.cookies.getAll().forEach((cookie) => {
    if (cookie.name.includes("next-auth") || cookie.name.includes("authjs")) {
      names.add(cookie.name);
    }
  });

  names.forEach((name) => {
    res.cookies.set(name, "", {
      expires: new Date(0),
      httpOnly: true,
      maxAge: 0,
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
  });

  res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
  res.headers.set("Pragma", "no-cache");
  res.headers.set("Clear-Site-Data", '"cache", "cookies", "storage"');
}
