import "server-only";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { resolveUserIdentity } from "@/lib/user-identity";

export function isBuyMarketAdminRole(value: unknown) {
  const role = String(value || "").trim().toLowerCase();
  return role === "admin" || role === "gm" || role === "superadmin";
}

export async function getBuyMarketCurrentUser() {
  const session = await getServerSession(authOptions);
  const identity = await resolveUserIdentity(session?.user);
  const role = String(session?.user?.role || "").trim().toLowerCase();

  return {
    id: String(identity.userId || "").trim(),
    name: identity.name,
    image: identity.image,
    role,
    isAdmin: isBuyMarketAdminRole(role),
  };
}
