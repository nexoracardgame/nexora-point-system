import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import {
  createNativeAuthHandoff,
  NATIVE_AUTH_HOST,
  NATIVE_AUTH_SCHEME,
  sanitizeNativeCallbackPath,
} from "@/lib/native-auth";
import { authOptions } from "@/lib/auth";
import {nativeLoopbackTarget} from '@/lib/native-loopback';

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

  const loopback=nativeLoopbackTarget(request.nextUrl.searchParams.get('loopback')),challenge=request.nextUrl.searchParams.get('challenge')||'';
  const local=request.nextUrl.searchParams.get('game')==='1'&&loopback&&/^[a-f0-9]{64}$/.test(challenge);
  const token = await createNativeAuthHandoff({
    userId,
    callbackPath,
    challenge:local?challenge:undefined,
  });
  const nativeUrl = new URL(local?loopback!:`${request.nextUrl.searchParams.get('game') === '1' ? 'nexoragame' : NATIVE_AUTH_SCHEME}://${NATIVE_AUTH_HOST}/callback`);
  nativeUrl.searchParams.set("token", token);

  return NextResponse.redirect(nativeUrl, { status: 302 });
}
