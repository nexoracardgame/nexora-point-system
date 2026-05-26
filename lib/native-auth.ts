import { decode, encode } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";

const NATIVE_HANDOFF_SALT = "nexora-native-auth-handoff";
const NATIVE_HANDOFF_MAX_AGE_SECONDS = 90;
const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

export const NATIVE_AUTH_SCHEME = "nexoratcg";
export const NATIVE_AUTH_HOST = "auth";

function getAuthSecret() {
  const secret = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET;

  if (!secret) {
    throw new Error("Missing NEXTAUTH_SECRET/AUTH_SECRET");
  }

  return secret;
}

export function sanitizeNativeCallbackPath(rawCallbackUrl?: string | null) {
  const raw = String(rawCallbackUrl || "").trim();

  if (!raw) {
    return "/";
  }

  try {
    const parsed = new URL(raw, "https://nexora-point-system.vercel.app");

    if (parsed.origin !== "https://nexora-point-system.vercel.app") {
      return "/";
    }

    if (parsed.pathname === "/login" || parsed.pathname.startsWith("/api/auth")) {
      return "/";
    }

    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return "/";
  }
}

export async function createNativeAuthHandoff(input: {
  userId: string;
  callbackPath: string;
}) {
  return encode({
    secret: getAuthSecret(),
    salt: NATIVE_HANDOFF_SALT,
    maxAge: NATIVE_HANDOFF_MAX_AGE_SECONDS,
    token: {
      purpose: "nexora-native-auth",
      sub: input.userId,
      userId: input.userId,
      callbackPath: input.callbackPath,
    } as any,
  });
}

export async function consumeNativeAuthHandoff(rawToken?: string | null) {
  const payload = await decode({
    token: String(rawToken || ""),
    secret: getAuthSecret(),
    salt: NATIVE_HANDOFF_SALT,
  });

  if (payload?.purpose !== "nexora-native-auth") {
    return null;
  }

  const userId = String(payload.userId || payload.sub || "").trim();

  if (!userId) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      lineId: true,
      name: true,
      displayName: true,
      image: true,
      role: true,
      nexPoint: true,
      coin: true,
      sessionVersion: true,
    },
  });

  if (!user) {
    return null;
  }

  const sessionIssuedAt = Date.now();
  const name = user.displayName || user.name || "NEXORA User";
  const picture = user.image || "/avatar.png";
  const authProvider = user.lineId.startsWith("google:")
    ? "google"
    : "line";
  const callbackPath = sanitizeNativeCallbackPath(
    typeof payload.callbackPath === "string" ? payload.callbackPath : null
  );

  const sessionToken = await encode({
    secret: getAuthSecret(),
    maxAge: SESSION_MAX_AGE_SECONDS,
    token: {
      sub: user.id,
      id: user.id,
      lineId: user.lineId,
      role: user.role || "USER",
      authProvider,
      sessionRevoked: false,
      sessionVersion: Math.max(1, Number(user.sessionVersion || 1)),
      sessionIssuedAt,
      nexPoint: Number(user.nexPoint || 0),
      coin: Number(user.coin || 0),
      name,
      picture,
    } as any,
  });

  return {
    callbackPath,
    maxAge: SESSION_MAX_AGE_SECONDS,
    sessionToken,
  };
}
