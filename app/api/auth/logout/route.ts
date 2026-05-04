import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import {
  clearAuthCookies,
  getAuthSecret,
  revokeUserSessions,
} from "@/lib/auth-session-control";

export async function POST(req: NextRequest) {
  const token = await getToken({
    req,
    secret: getAuthSecret(),
  }).catch(() => null);
  const userId = String(
    ((token || {}) as { id?: string | null; sub?: string | null }).id ||
      ((token || {}) as { sub?: string | null }).sub ||
      ""
  ).trim();

  if (userId) {
    await revokeUserSessions(userId).catch((error) => {
      console.error("REVOKE USER SESSIONS ERROR:", error);
    });
  }

  const response = NextResponse.json({
    success: true,
    revoked: Boolean(userId),
  });

  clearAuthCookies(req, response);
  return response;
}
