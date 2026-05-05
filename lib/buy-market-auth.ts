import "server-only";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { resolveUserIdentity } from "@/lib/user-identity";

export async function getBuyMarketCurrentUser() {
  const session = await getServerSession(authOptions);
  const identity = await resolveUserIdentity(session?.user);

  return {
    id: String(identity.userId || "").trim(),
    name: identity.name,
    image: identity.image,
  };
}
