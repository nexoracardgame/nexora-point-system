import { NextRequest, NextResponse } from "next/server";
import { consumeNativeAuthHandoff } from "@/lib/native-auth";

export async function GET(request: NextRequest) {
  const handoff = await consumeNativeAuthHandoff(
    request.nextUrl.searchParams.get("token")
  );

  if (!handoff) {
    const loginUrl = new URL("/login", request.nextUrl.origin);
    loginUrl.searchParams.set("error", "AccessDenied");
    return NextResponse.redirect(loginUrl);
  }

  const targetUrl = new URL(handoff.callbackPath, request.nextUrl.origin);
  const response = NextResponse.redirect(targetUrl);

  response.cookies.set("__Secure-next-auth.session-token", handoff.sessionToken, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: handoff.maxAge,
  });
  response.cookies.set("next-auth.session-token", "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  return response;
}
