import { NextRequest, NextResponse } from "next/server";
import { sanitizeNativeCallbackPath } from "@/lib/native-auth";
import {nativeLoopbackTarget} from '@/lib/native-loopback';
import {nativeProviderStart} from '@/lib/native-provider-start';

const PROVIDERS = new Set(["line", "google"]);

export async function GET(request: NextRequest) {
  const provider = String(request.nextUrl.searchParams.get("provider") || "");

  if (!PROVIDERS.has(provider)) {
    const loginUrl = new URL(request.nextUrl.searchParams.get('game')==='1'?'/game/login':'/login', request.nextUrl.origin);
    loginUrl.searchParams.set("error", "AccessDenied");
    return NextResponse.redirect(loginUrl);
  }

  const callbackPath = sanitizeNativeCallbackPath(
    request.nextUrl.searchParams.get("callbackUrl")
  );
  const nativeIssueUrl = new URL("/api/auth/native/issue", request.nextUrl.origin);
  nativeIssueUrl.searchParams.set("callbackUrl", callbackPath);
  if (request.nextUrl.searchParams.get('game') === '1') nativeIssueUrl.searchParams.set('game','1');
  const loopback=nativeLoopbackTarget(request.nextUrl.searchParams.get('loopback')),challenge=request.nextUrl.searchParams.get('challenge')||'';
  if(loopback&&/^[a-f0-9]{64}$/.test(challenge)&&request.nextUrl.searchParams.get('game')==='1'){nativeIssueUrl.searchParams.set('loopback',loopback);nativeIssueUrl.searchParams.set('challenge',challenge)}

  try{
    const started=await nativeProviderStart(request.nextUrl.origin,provider as 'google'|'line',nativeIssueUrl.toString(),request.headers.get('cookie')||'');
    const response=NextResponse.redirect(started.url,302);
    for(const cookie of started.cookies)response.headers.append('Set-Cookie',cookie);
    response.headers.set('Cache-Control','no-store');
    return response;
  }catch{
    const login=new URL(request.nextUrl.searchParams.get('game')==='1'?'/game/login':'/login',request.nextUrl.origin);
    login.searchParams.set('error','OAuthSignin');
    return NextResponse.redirect(login);
  }
}
