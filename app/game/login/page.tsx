import LoginClient from "@/app/login/LoginClient";

export default async function GameLoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const raw = typeof query.callbackUrl === "string" ? query.callbackUrl : "/game";
  const callback = raw === "/game" || raw.startsWith("/game?") || raw.startsWith("/game/pentad?") || raw === "/game/pentad" ? raw : "/game";
  return <LoginClient game rawCallbackUrl={callback} authError={typeof query.error === "string" ? query.error : undefined} />;
}
