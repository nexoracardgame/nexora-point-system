import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAuthProvider } from "@/lib/auth-identities";
import {
  AUTH_LINK_COOKIE_NAME,
  createAuthLinkCookieValue,
} from "@/lib/auth-link-cookie";

function cookieOptions() {
  return {
    httpOnly: true,
    maxAge: 5 * 60,
    path: "/",
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
  };
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = String(session?.user?.id || "").trim();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const provider = String(body?.provider || "").trim();

    if (!isAuthProvider(provider)) {
      return NextResponse.json({ error: "Invalid provider" }, { status: 400 });
    }

    const response = NextResponse.json({
      success: true,
      provider,
    });

    response.cookies.set(
      AUTH_LINK_COOKIE_NAME,
      createAuthLinkCookieValue(userId, provider),
      cookieOptions()
    );

    return response;
  } catch (error) {
    console.error("AUTH LINK START ERROR:", error);
    return NextResponse.json(
      { error: "Account link start failed" },
      { status: 500 }
    );
  }
}
