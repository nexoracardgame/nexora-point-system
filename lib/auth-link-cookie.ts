import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { getAuthProvider, type AuthProvider } from "@/lib/auth-identities";

export const AUTH_LINK_COOKIE_NAME = "nexora_auth_link";
export const AUTH_LINK_TTL_SECONDS = 10 * 60;

const AUTH_LINK_TTL_MS = AUTH_LINK_TTL_SECONDS * 1000;

type AuthLinkPayload = {
  userId: string;
  provider: AuthProvider;
  exp: number;
  nonce: string;
};

function getAuthLinkSecret() {
  return String(
    process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET || ""
  ).trim();
}

function signValue(value: string) {
  const secret = getAuthLinkSecret();

  if (!secret) {
    throw new Error("Missing auth link secret");
  }

  return createHmac("sha256", secret).update(value).digest("base64url");
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

export function createAuthLinkCookieValue(
  userId: string,
  provider: AuthProvider
) {
  const payload: AuthLinkPayload = {
    userId,
    provider,
    exp: Date.now() + AUTH_LINK_TTL_MS,
    nonce: randomBytes(12).toString("base64url"),
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = signValue(body);

  return `${body}.${signature}`;
}

export function verifyAuthLinkCookieValue(
  value?: string | null,
  expectedProvider?: AuthProvider | null
) {
  const raw = String(value || "").trim();
  const [body, signature] = raw.split(".");

  if (!body || !signature || !safeEqual(signature, signValue(body))) {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8")
    ) as AuthLinkPayload;
    const provider = getAuthProvider(payload.provider);
    const userId = String(payload.userId || "").trim();

    if (!userId || provider !== payload.provider || payload.exp < Date.now()) {
      return null;
    }

    if (expectedProvider && provider !== expectedProvider) {
      return null;
    }

    return {
      userId,
      provider,
    };
  } catch {
    return null;
  }
}
