import "server-only";

import { prisma } from "@/lib/prisma";

export type BoxMarketSessionUser = {
  id?: string | null;
  lineId?: string | null;
  name?: string | null;
  image?: string | null;
};

export type BoxMarketIdentity = {
  name: string;
  image: string;
  userId: string;
};

export function getBoxMarketSessionUser(
  session: { user?: BoxMarketSessionUser } | null | undefined
) {
  return session?.user || ({} as BoxMarketSessionUser);
}

export async function resolveBoxMarketUserId(
  sessionUser: BoxMarketSessionUser,
  identity: BoxMarketIdentity
) {
  const sessionUserId = String(sessionUser.id || "").trim();
  const sessionLineId = String(sessionUser.lineId || "").trim();

  if (sessionLineId) {
    const dbUser = await prisma.user.upsert({
      where: {
        lineId: sessionLineId,
      },
      update: {
        name: identity.name,
        image: identity.image,
      },
      create: {
        lineId: sessionLineId,
        name: identity.name,
        image: identity.image,
        role: "USER",
      },
      select: {
        id: true,
      },
    });

    return String(dbUser.id || "").trim();
  }

  if (!sessionUserId) {
    return String(identity.userId || "").trim();
  }

  const dbUser = await prisma.user.findFirst({
    where: {
      OR: [{ id: sessionUserId }, { lineId: sessionUserId }],
    },
    select: {
      id: true,
    },
  });

  return String(dbUser?.id || sessionUserId).trim();
}
