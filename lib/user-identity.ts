import { getLocalProfileByUserId } from "@/lib/local-profile-store";

export type SessionIdentityUser = {
  id?: string;
  name?: string | null;
  image?: string | null;
};

export type ResolvedUserIdentity = {
  userId: string;
  name: string;
  image: string;
};

export function sanitizeUserName(name?: string | null, fallback = "NEXORA User") {
  const value = String(name || "").trim();
  return value || fallback;
}

export function sanitizeUserImage(image?: string | null, fallback = "/avatar.png") {
  const value = String(image || "").trim();
  return value || fallback;
}

export async function resolveUserIdentity(
  sessionUser?: SessionIdentityUser | null
): Promise<ResolvedUserIdentity> {
  const userId = String(sessionUser?.id || "").trim();
  const profile = userId ? await getLocalProfileByUserId(userId) : null;

  return {
    userId,
    name: sanitizeUserName(profile?.displayName || sessionUser?.name),
    image: sanitizeUserImage(profile?.image || sessionUser?.image),
  };
}
