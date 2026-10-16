import LoginClient from "./LoginClient";
import { redirect } from "next/navigation";
import {cookies} from 'next/headers';

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const callbackValue = resolvedSearchParams?.callbackUrl;
  const errorValue = resolvedSearchParams?.error;
  let rawCallbackUrl = Array.isArray(callbackValue)
    ? callbackValue[0]
    : callbackValue;
  if(!rawCallbackUrl){const jar=await cookies();const remembered=jar.get('__Secure-next-auth.callback-url')?.value||jar.get('next-auth.callback-url')?.value;if(remembered){try{const url=new URL(remembered,process.env.NEXTAUTH_URL);if(url.pathname==='/game'||url.pathname.startsWith('/game/'))rawCallbackUrl=url.pathname+url.search}catch{}}}
  const authError = Array.isArray(errorValue) ? errorValue[0] : errorValue;
  if (rawCallbackUrl) {
    try {
      const callback = new URL(rawCallbackUrl, process.env.NEXTAUTH_URL || "https://nexora-point-system.vercel.app");
      if (callback.pathname === "/game" || callback.pathname.startsWith("/game/")) {
        const params = new URLSearchParams({ callbackUrl: callback.pathname + callback.search });
        if (authError) params.set("error", authError);
        redirect(`/game/login?${params}`);
      }
    } catch (error) {
      if (error instanceof Error && error.message === "NEXT_REDIRECT") throw error;
    }
  }

  return <LoginClient rawCallbackUrl={rawCallbackUrl} authError={authError} />;
}
