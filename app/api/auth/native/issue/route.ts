import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import {
  createNativeAuthHandoff,
  NATIVE_AUTH_HOST,
  NATIVE_AUTH_SCHEME,
  sanitizeNativeCallbackPath,
} from "@/lib/native-auth";
import { authOptions } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = String(session?.user?.id || "").trim();
  const callbackPath = sanitizeNativeCallbackPath(
    request.nextUrl.searchParams.get("callbackUrl")
  );

  if (!userId) {
    const loginUrl = new URL("/login", request.nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", callbackPath);
    return NextResponse.redirect(loginUrl);
  }

  const token = await createNativeAuthHandoff({
    userId,
    callbackPath,
  });
  const nativeUrl = new URL(`${NATIVE_AUTH_SCHEME}://${NATIVE_AUTH_HOST}/callback`);
  nativeUrl.searchParams.set("token", token);

  return NextResponse.redirect(nativeUrl, { status: 302 });
}
