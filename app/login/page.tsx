import LoginClient from "./LoginClient";
import { redirect } from "next/navigation";

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const callbackValue = resolvedSearchParams?.callbackUrl;
  const errorValue = resolvedSearchParams?.error;
  const rawCallbackUrl = Array.isArray(callbackValue)
    ? callbackValue[0]
    : callbackValue;
  const authError = Array.isArray(errorValue) ? errorValue[0] : errorValue;
  if (rawCallbackUrl) {
    try {
      const callback = new URL(rawCallbackUrl, process.env.NEXTAUTH_URL || "https://nexora-point-system.vercel.app");
      if (callback.pathname === "/game" || callback.pathname === "/game/pentad") {
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
