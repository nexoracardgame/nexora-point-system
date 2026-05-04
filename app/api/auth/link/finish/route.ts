import { NextResponse } from "next/server";
import { AUTH_LINK_COOKIE_NAME } from "@/lib/auth-link-cookie";

export async function POST() {
  const response = NextResponse.json({ success: true });

  response.cookies.set(AUTH_LINK_COOKIE_NAME, "", {
    httpOnly: true,
    maxAge: 0,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  return response;
}
