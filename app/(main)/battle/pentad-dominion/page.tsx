import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import PentadDominionClient from "./PentadDominionClient";

export default async function PentadDominionPage({ searchParams }: { searchParams: Promise<{room?:string; spectate?:string}> }) {
  const query = await searchParams;
  const session = await getServerSession(authOptions);
  const params = new URLSearchParams(); if (query.room) params.set("room",query.room); if (query.spectate) params.set("spectate",query.spectate);
  if (!session?.user?.id) redirect(`/login?callbackUrl=${encodeURIComponent(`/battle/pentad-dominion${params.size ? `?${params}` : ""}`)}`);
  return <PentadDominionClient userId={String(session.user.id)} initialRoomCode={query.room || ""} initialSpectate={query.spectate === "1"} />;
}
