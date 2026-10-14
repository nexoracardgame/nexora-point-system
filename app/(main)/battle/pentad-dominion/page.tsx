import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import PentadDominionClient from "./PentadDominionClient";

export default async function PentadDominionPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login?callbackUrl=/battle/pentad-dominion");
  return <PentadDominionClient userId={String(session.user.id)} />;
}
