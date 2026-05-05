import { NextRequest, NextResponse } from "next/server";
import { AUTH_LINK_COOKIE_NAME } from "@/lib/auth-link-cookie";

function isSecureRequest(req: NextRequest) {
  const forwardedProto = String(req.headers.get("x-forwarded-proto") || "")
    .split(",")[0]
    .trim()
    .toLowerCase();
  const protocol = String(req.nextUrl.protocol || "").replace(":", "");

  return forwardedProto === "https" || protocol === "https";
}

export async function POST(req: NextRequest) {
  const response = NextResponse.json({ success: true });

  response.cookies.set(AUTH_LINK_COOKIE_NAME, "", {
    httpOnly: true,
    maxAge: 0,
    path: "/",
    sameSite: "lax",
    secure: isSecureRequest(req),
  });

  return response;
}
