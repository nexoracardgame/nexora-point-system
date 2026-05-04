import { prisma } from "@/lib/prisma";
import { getServerSupabaseClient } from "@/lib/supabase-server";

export type AuthProvider = "line" | "google";

export type LinkedAuthProviders = Record<AuthProvider, boolean>;

type ProviderProfile = {
  email?: string | null;
  name?: string | null;
  image?: string | null;
};

const AUTH_PROVIDERS: AuthProvider[] = ["line", "google"];

let authIdentitySchemaReadyPromise: Promise<void> | null = null;

function uniqueStrings(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(values.map((value) => String(value || "").trim()).filter(Boolean))
  );
}

export function isAuthProvider(value?: string | null): value is AuthProvider {
  return value === "line" || value === "google";
}

export function getAuthProvider(value?: string | null): AuthProvider {
  return isAuthProvider(value) ? value : "line";
}

export function getProviderIdentity(
  provider: AuthProvider,
  providerAccountId?: string | null
) {
  const subject = String(providerAccountId || "").trim();

  if (!subject) {
    return "";
  }

  return provider === "google" ? `google:${subject}` : subject;
}

export function inferLegacyProviderFromLineId(lineId?: string | null) {
  const safeLineId = String(lineId || "").trim();

  if (!safeLineId) {
    return null;
  }

  return safeLineId.startsWith("google:") ? "google" : "line";
}

export async function ensureAuthIdentitySchema() {
  if (!authIdentitySchemaReadyPromise) {
    authIdentitySchemaReadyPromise = (async () => {
      await prisma.$executeRawUnsafe(
        'CREATE TABLE IF NOT EXISTS "AuthIdentity" ("id" TEXT NOT NULL, "userId" TEXT NOT NULL, "provider" TEXT NOT NULL, "providerAccountId" TEXT NOT NULL, "email" TEXT, "name" TEXT, "image" TEXT, "linkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "AuthIdentity_pkey" PRIMARY KEY ("id"))'
      );
      await prisma.$executeRawUnsafe(
        'DO $$ BEGIN ALTER TABLE "AuthIdentity" ADD CONSTRAINT "AuthIdentity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;'
      );
      await prisma.$executeRawUnsafe(
        'CREATE UNIQUE INDEX IF NOT EXISTS "AuthIdentity_provider_providerAccountId_key" ON "AuthIdentity"("provider", "providerAccountId")'
      );
      await prisma.$executeRawUnsafe(
        'CREATE INDEX IF NOT EXISTS "AuthIdentity_userId_idx" ON "AuthIdentity"("userId")'
      );
    })();
  }

  return authIdentitySchemaReadyPromise;
}

export async function getAuthIdentity(
  provider: AuthProvider,
  providerAccountId: string
) {
  const safeProviderAccountId = String(providerAccountId || "").trim();

  if (!safeProviderAccountId) {
    return null;
  }

  await ensureAuthIdentitySchema();

  return prisma.authIdentity.findUnique({
    where: {
      provider_providerAccountId: {
        provider,
        providerAccountId: safeProviderAccountId,
      },
    },
  });
}

export async function upsertAuthIdentity(
  userId: string,
  provider: AuthProvider,
  providerAccountId: string,
  profile: ProviderProfile = {}
) {
  const safeUserId = String(userId || "").trim();
  const safeProviderAccountId = String(providerAccountId || "").trim();

  if (!safeUserId || !safeProviderAccountId) {
    return null;
  }

  await ensureAuthIdentitySchema();

  return prisma.authIdentity.upsert({
    where: {
      provider_providerAccountId: {
        provider,
        providerAccountId: safeProviderAccountId,
      },
    },
    update: {
      userId: safeUserId,
      email: String(profile.email || "").trim() || null,
      name: String(profile.name || "").trim() || null,
      image: String(profile.image || "").trim() || null,
    },
    create: {
      userId: safeUserId,
      provider,
      providerAccountId: safeProviderAccountId,
      email: String(profile.email || "").trim() || null,
      name: String(profile.name || "").trim() || null,
      image: String(profile.image || "").trim() || null,
    },
  });
}

export async function getLinkedAuthProviders(
  userId?: string | null,
  legacyLineId?: string | null
): Promise<LinkedAuthProviders> {
  const result: LinkedAuthProviders = {
    line: false,
    google: false,
  };
  const safeUserId = String(userId || "").trim();
  const legacyProvider = inferLegacyProviderFromLineId(legacyLineId);

  if (legacyProvider) {
    result[legacyProvider] = true;
  }

  if (!safeUserId) {
    return result;
  }

  try {
    await ensureAuthIdentitySchema();
    const identities = await prisma.authIdentity.findMany({
      where: {
        userId: safeUserId,
        provider: {
          in: AUTH_PROVIDERS,
        },
      },
      select: {
        provider: true,
      },
    });

    identities.forEach((identity) => {
      if (isAuthProvider(identity.provider)) {
        result[identity.provider] = true;
      }
    });
  } catch {
    return result;
  }

  return result;
}

async function mergeSupabaseDmAliases(input: {
  primaryUserId: string;
  secondaryAliases: string[];
  name?: string | null;
  image?: string | null;
}) {
  const supabase = getServerSupabaseClient();

  if (!supabase) {
    return;
  }

  const primaryUserId = String(input.primaryUserId || "").trim();
  const name = String(input.name || "NEXORA User").trim();
  const image = String(input.image || "/avatar.png").trim();
  const aliases = uniqueStrings(input.secondaryAliases);

  if (!primaryUserId || aliases.length === 0) {
    return;
  }

  await Promise.allSettled(
    aliases.flatMap((alias) => [
      supabase
        .from("dm_room")
        .update({
          usera: primaryUserId,
          useraname: name,
          useraimage: image,
        })
        .eq("usera", alias),
      supabase
        .from("dm_room")
        .update({
          userb: primaryUserId,
          userbname: name,
          userbimage: image,
        })
        .eq("userb", alias),
      supabase
        .from("dmMessage")
        .update({
          senderId: primaryUserId,
          senderName: name,
          senderImage: image,
        })
        .eq("senderId", alias),
    ])
  );
}

export async function mergeUserAccounts(primaryUserId: string, secondaryUserId: string) {
  const safePrimaryUserId = String(primaryUserId || "").trim();
  const safeSecondaryUserId = String(secondaryUserId || "").trim();

  if (!safePrimaryUserId || !safeSecondaryUserId || safePrimaryUserId === safeSecondaryUserId) {
    return null;
  }

  await ensureAuthIdentitySchema();

  const [primaryUser, secondaryUser] = await Promise.all([
    prisma.user.findUnique({ where: { id: safePrimaryUserId } }),
    prisma.user.findUnique({ where: { id: safeSecondaryUserId } }),
  ]);

  if (!primaryUser || !secondaryUser) {
    return primaryUser || null;
  }

  const secondaryAliases = uniqueStrings([secondaryUser.id, secondaryUser.lineId]);

  const updatedUser = await prisma.$transaction(async (tx) => {
    await tx.coupon.updateMany({
      where: { userId: secondaryUser.id },
      data: { userId: primaryUser.id },
    });
    await tx.marketListing.updateMany({
      where: { sellerId: secondaryUser.id },
      data: { sellerId: primaryUser.id },
    });
    await tx.sellerReview.updateMany({
      where: { sellerId: secondaryUser.id },
      data: { sellerId: primaryUser.id },
    });
    await tx.sellerReview.updateMany({
      where: { buyerId: secondaryUser.id },
      data: { buyerId: primaryUser.id },
    });
    await tx.dealRequest.updateMany({
      where: { buyerId: secondaryUser.id },
      data: { buyerId: primaryUser.id },
    });
    await tx.dealRequest.updateMany({
      where: { sellerId: secondaryUser.id },
      data: { sellerId: primaryUser.id },
    });
    await tx.wishlist.updateMany({
      where: { userId: secondaryUser.id },
      data: { userId: primaryUser.id },
    });
    await tx.marketHistory.updateMany({
      where: { sellerId: secondaryUser.id },
      data: { sellerId: primaryUser.id },
    });
    await tx.marketHistory.updateMany({
      where: { buyerId: secondaryUser.id },
      data: { buyerId: primaryUser.id },
    });
    await tx.marketBid.updateMany({
      where: { bidder: secondaryUser.id },
      data: { bidder: primaryUser.id },
    });
    await tx.dmRoom.updateMany({
      where: { user1: { in: secondaryAliases } },
      data: { user1: primaryUser.id },
    });
    await tx.dmRoom.updateMany({
      where: { user2: { in: secondaryAliases } },
      data: { user2: primaryUser.id },
    });
    await tx.dmMessage.updateMany({
      where: { senderId: { in: secondaryAliases } },
      data: { senderId: primaryUser.id },
    });
    await tx.pointLog.updateMany({
      where: { lineId: secondaryUser.lineId },
      data: { lineId: primaryUser.lineId },
    });
    await tx.authIdentity.updateMany({
      where: { userId: secondaryUser.id },
      data: { userId: primaryUser.id },
    });

    const updatedPrimaryUser = await tx.user.update({
      where: { id: primaryUser.id },
      data: {
        name: primaryUser.name || secondaryUser.name,
        displayName: primaryUser.displayName || secondaryUser.displayName,
        image: primaryUser.image || secondaryUser.image,
        coverImage: primaryUser.coverImage || secondaryUser.coverImage,
        coverPosition:
          primaryUser.coverPosition === null || primaryUser.coverPosition === undefined
            ? secondaryUser.coverPosition
            : primaryUser.coverPosition,
        bio: primaryUser.bio || secondaryUser.bio,
        facebookUrl: primaryUser.facebookUrl || secondaryUser.facebookUrl,
        lineUrl: primaryUser.lineUrl || secondaryUser.lineUrl,
        nexPoint: { increment: Number(secondaryUser.nexPoint || 0) },
        coin: { increment: Number(secondaryUser.coin || 0) },
        role:
          String(primaryUser.role || "").toLowerCase() === "user" &&
          String(secondaryUser.role || "").toLowerCase() !== "user"
            ? secondaryUser.role
            : primaryUser.role,
      },
    });

    await tx.user.delete({
      where: { id: secondaryUser.id },
    });

    return updatedPrimaryUser;
  });

  await prisma
    .$executeRawUnsafe(
      'UPDATE "dmRoomClearState" SET "userId" = $1 WHERE "userId" = $2',
      updatedUser.id,
      secondaryUser.id
    )
    .catch(() => undefined);
  await prisma
    .$executeRawUnsafe(
      'UPDATE "dmConversationClearState" SET "userId" = $1 WHERE "userId" = $2',
      updatedUser.id,
      secondaryUser.id
    )
    .catch(() => undefined);

  for (const alias of secondaryAliases) {
    await prisma
      .$executeRawUnsafe(
        'UPDATE "dmConversationClearState" SET "peerUserId" = $1 WHERE "peerUserId" = $2',
        updatedUser.id,
        alias
      )
      .catch(() => undefined);
  }

  await mergeSupabaseDmAliases({
    primaryUserId: updatedUser.id,
    secondaryAliases,
    name: updatedUser.displayName || updatedUser.name,
    image: updatedUser.image,
  }).catch(() => undefined);

  return updatedUser;
}
