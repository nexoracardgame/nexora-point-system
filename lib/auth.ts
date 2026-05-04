import { NextAuthOptions } from "next-auth";
import { cookies } from "next/headers";
import GoogleProvider from "next-auth/providers/google";
import LineProvider from "next-auth/providers/line";
import { JWT } from "next-auth/jwt";
import { getLocalProfileByUserId } from "@/lib/local-profile-store";
import { prisma } from "@/lib/prisma";
import {
  getAuthIdentity,
  getAuthProvider,
  getProviderIdentity,
  mergeUserAccounts,
  upsertAuthIdentity,
  type AuthProvider,
} from "@/lib/auth-identities";
import {
  AUTH_LINK_COOKIE_NAME,
  verifyAuthLinkCookieValue,
} from "@/lib/auth-link-cookie";
import {
  createProviderProfileImageSnapshot,
  isDefaultProfileImageUrl,
  isProviderProfileImageUrl,
} from "@/lib/profile-image-snapshot";
import { syncUserIdentityEverywhere } from "@/lib/user-identity-sync";

type OAuthProfile = {
  sub?: string;
  name?: string;
  picture?: string;
  email?: string;
};

type SessionUpdatePayload = {
  name?: string | null;
  image?: string | null;
};

type AppToken = JWT & {
  id?: string;
  lineId?: string;
  authProvider?: AuthProvider;
  role?: string;
  nexPoint?: number;
  coin?: number;
};

type DbUserSnapshot = {
  id: string;
  lineId: string;
  name: string | null;
  displayName?: string | null;
  image: string | null;
  role: string;
  nexPoint: number;
  coin: number;
};

function getSafeSessionImage(image?: string | null) {
  const raw = String(image || "").trim();

  if (!raw) return "/avatar.png";

  if (raw.startsWith("data:image/")) {
    return "/avatar.png";
  }

  return raw;
}

function getProviderImage(appToken: AppToken, profile: OAuthProfile) {
  return getSafeSessionImage(
    profile.picture ||
      (typeof appToken.picture === "string" ? appToken.picture : null)
  );
}

function shouldRepairStoredProfileImage(image?: string | null) {
  const safeImage = getSafeSessionImage(image);
  return (
    isDefaultProfileImageUrl(image) ||
    isDefaultProfileImageUrl(safeImage) ||
    isProviderProfileImageUrl(safeImage)
  );
}

async function getStableInitialProfileImage(
  image: string,
  lineId: string,
  provider: AuthProvider,
  userId?: string | null
) {
  const safeImage = getSafeSessionImage(image);

  if (!isProviderProfileImageUrl(safeImage)) {
    return safeImage;
  }

  const snapshotImage = await createProviderProfileImageSnapshot(safeImage, {
    userId,
    lineId,
    provider,
  });

  return snapshotImage || safeImage;
}

function resolveSessionProfileImage(
  localImage?: string | null,
  tokenImage?: string | null
) {
  const safeLocalImage = getSafeSessionImage(localImage);
  const safeTokenImage = getSafeSessionImage(tokenImage);
  const tokenHasStableImage =
    !isDefaultProfileImageUrl(safeTokenImage) &&
    !isProviderProfileImageUrl(safeTokenImage);

  if (
    tokenHasStableImage &&
    (isDefaultProfileImageUrl(safeLocalImage) ||
      isProviderProfileImageUrl(safeLocalImage))
  ) {
    return safeTokenImage;
  }

  return safeLocalImage;
}

function getProviderSubject(
  profile: OAuthProfile,
  fallbackSubject?: string | null
) {
  return String(profile.sub || fallbackSubject || "").trim();
}

async function getPendingAuthLinkUserId(provider: AuthProvider) {
  try {
    const cookieStore = await cookies();
    const pendingLink = verifyAuthLinkCookieValue(
      cookieStore.get(AUTH_LINK_COOKIE_NAME)?.value,
      provider
    );

    return pendingLink?.userId || "";
  } catch {
    return "";
  }
}

const dbUserSelect = {
  id: true,
  lineId: true,
  name: true,
  image: true,
  displayName: true,
  role: true,
  nexPoint: true,
  coin: true,
} as const;

type DbUserRecord = {
  id: string;
  lineId: string;
  name: string | null;
  displayName: string | null;
  image: string | null;
  role: string;
  nexPoint: number;
  coin: number;
};

function toDbUserSnapshot(user: DbUserRecord): DbUserSnapshot {
  return {
    id: user.id,
    lineId: user.lineId,
    name: user.displayName || user.name,
    image: user.image,
    role: user.role,
    nexPoint: user.nexPoint,
    coin: user.coin,
  };
}

async function findDbUserById(userId?: string | null) {
  const safeUserId = String(userId || "").trim();

  if (!safeUserId) {
    return null;
  }

  return prisma.user.findUnique({
    where: { id: safeUserId },
    select: dbUserSelect,
  });
}

async function findDbUserByLineId(lineId?: string | null) {
  const safeLineId = String(lineId || "").trim();

  if (!safeLineId) {
    return null;
  }

  return prisma.user.findUnique({
    where: { lineId: safeLineId },
    select: dbUserSelect,
  });
}

async function patchDbUserProfile(
  existingUser: DbUserRecord,
  safeName: string,
  providerImage: string,
  provider: AuthProvider
) {
  const existingImage = String(existingUser.image || "").trim();
  const stableImage = shouldRepairStoredProfileImage(existingUser.image)
    ? await getStableInitialProfileImage(
        providerImage,
        existingUser.lineId,
        provider,
        existingUser.id
      )
    : undefined;
  const nextImage =
    stableImage &&
    stableImage !== existingImage &&
    !isDefaultProfileImageUrl(stableImage) &&
    !(
      isProviderProfileImageUrl(existingImage) &&
      isProviderProfileImageUrl(stableImage)
    )
      ? stableImage
      : undefined;
  const needsPatch =
    !String(existingUser.name || "").trim() ||
    !String(existingUser.image || "").trim() ||
    !String(existingUser.displayName || "").trim() ||
    Boolean(nextImage);

  if (!needsPatch) {
    return toDbUserSnapshot(existingUser);
  }

  const patchedUser = await prisma.user.update({
    where: { id: existingUser.id },
    data: {
      name: String(existingUser.name || "").trim() ? undefined : safeName,
      displayName: String(existingUser.displayName || "").trim()
        ? undefined
        : safeName,
      image: nextImage,
    },
    select: dbUserSelect,
  });

  if (nextImage) {
    await syncUserIdentityEverywhere({
      userId: patchedUser.id,
      lineId: patchedUser.lineId,
      name: patchedUser.displayName || patchedUser.name || safeName,
      image: patchedUser.image,
    }).catch(() => undefined);
  }

  return toDbUserSnapshot(patchedUser);
}

async function createDbUser(
  lineId: string,
  safeName: string,
  providerImage: string,
  provider: AuthProvider
) {
  const initialImage = await getStableInitialProfileImage(
    providerImage,
    lineId,
    provider,
    lineId
  );

  const createdUser = await prisma.user.create({
    data: {
      lineId,
      name: safeName,
      displayName: safeName,
      image: initialImage,
      role: "USER",
    },
    select: dbUserSelect,
  });

  return toDbUserSnapshot(createdUser);
}

async function ensureDbUser(
  appToken: AppToken,
  profile: OAuthProfile,
  provider: AuthProvider,
  fallbackSubject?: string | null
) {
  const providerSubject = getProviderSubject(profile, fallbackSubject);
  const providerLineId = getProviderIdentity(provider, providerSubject);
  const pendingLinkUserId = providerSubject
    ? await getPendingAuthLinkUserId(provider)
    : "";
  const currentUserId =
    pendingLinkUserId || String(appToken.id || "").trim();
  const safeName = String(appToken.name || profile.name || "NEXORA User").trim();
  const providerImage = getProviderImage(appToken, profile);

  try {
    if (!providerSubject) {
      const sessionUser =
        (await findDbUserById(currentUserId)) ||
        (await findDbUserByLineId(appToken.lineId));

      return sessionUser ? toDbUserSnapshot(sessionUser) : null;
    }

    const [currentUser, identity, legacyUser] = await Promise.all([
      findDbUserById(currentUserId),
      getAuthIdentity(provider, providerSubject),
      findDbUserByLineId(providerLineId),
    ]);
    const identityUser = identity?.userId
      ? await findDbUserById(identity.userId)
      : null;
    const identityProfile = {
      email: profile.email,
      name: profile.name,
      image: providerImage,
    };

    if (currentUser) {
      const mergeTargetIds = Array.from(
        new Set(
          [identityUser?.id, legacyUser?.id].filter(
            (id): id is string => Boolean(id && id !== currentUser.id)
          )
        )
      );

      for (const mergeTargetId of mergeTargetIds) {
        await mergeUserAccounts(currentUser.id, mergeTargetId);
      }

      const refreshedUser = await findDbUserById(currentUser.id);

      if (!refreshedUser) {
        return null;
      }

      await upsertAuthIdentity(
        refreshedUser.id,
        provider,
        providerSubject,
        identityProfile
      );

      return patchDbUserProfile(
        refreshedUser,
        safeName,
        providerImage,
        provider
      );
    }

    if (identityUser) {
      if (legacyUser && legacyUser.id !== identityUser.id) {
        await mergeUserAccounts(identityUser.id, legacyUser.id);
      }

      const refreshedUser = await findDbUserById(identityUser.id);

      if (!refreshedUser) {
        return null;
      }

      await upsertAuthIdentity(
        refreshedUser.id,
        provider,
        providerSubject,
        identityProfile
      );

      return patchDbUserProfile(
        refreshedUser,
        safeName,
        providerImage,
        provider
      );
    }

    if (legacyUser) {
      await upsertAuthIdentity(
        legacyUser.id,
        provider,
        providerSubject,
        identityProfile
      );

      return patchDbUserProfile(legacyUser, safeName, providerImage, provider);
    }

    if (!providerLineId) {
      return null;
    }

    const createdUser = await createDbUser(
      providerLineId,
      safeName,
      providerImage,
      provider
    );

    await upsertAuthIdentity(
      createdUser.id,
      provider,
      providerSubject,
      identityProfile
    );

    return createdUser;
  } catch (error) {
    console.error("AUTH USER UPSERT ERROR:", error);
    return null;
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    LineProvider({
      clientId: process.env.LINE_CLIENT_ID!,
      clientSecret: process.env.LINE_CLIENT_SECRET!,
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],

  secret: process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET,

  pages: {
    signIn: "/login",
    error: "/login",
  },

  session: {
    strategy: "jwt",
  },

  callbacks: {
    async signIn({ account, profile }) {
      const provider = getAuthProvider(account?.provider);
      const oauthProfile = (profile || {}) as OAuthProfile;
      const providerSubject = getProviderSubject(
        oauthProfile,
        account?.providerAccountId
      );
      const lineId = getProviderIdentity(provider, providerSubject);

      if (!lineId) return false;

      return true;
    },

    async jwt({ token, account, profile, trigger, session }) {
      const appToken = token as AppToken;

      if (trigger === "update") {
        const updatePayload = (session || {}) as SessionUpdatePayload;

        if (typeof updatePayload.name === "string" && updatePayload.name.trim()) {
          appToken.name = updatePayload.name.trim();
        }

        if ("image" in updatePayload) {
          appToken.picture = getSafeSessionImage(updatePayload.image);
        }
      }

      const oauthProfile = (profile || {}) as OAuthProfile;
      const provider = getAuthProvider(account?.provider || appToken.authProvider);
      const providerAccountId = account?.providerAccountId;
      const providerSubject = getProviderSubject(oauthProfile, providerAccountId);

      if (providerSubject) {
        appToken.authProvider = provider;
        appToken.name = appToken.name || oauthProfile.name || "NEXORA User";
        appToken.picture = getSafeSessionImage(
          typeof appToken.picture === "string"
            ? appToken.picture
            : oauthProfile.picture
        );
      }

      appToken.authProvider = getAuthProvider(appToken.authProvider || provider);
      appToken.role = appToken.role || "USER";
      appToken.nexPoint = appToken.nexPoint || 0;
      appToken.coin = appToken.coin || 0;
      appToken.name = appToken.name || "NEXORA User";
      appToken.picture = getSafeSessionImage(
        typeof appToken.picture === "string" ? appToken.picture : null
      );

      const dbUser = await ensureDbUser(
        appToken,
        oauthProfile,
        appToken.authProvider,
        providerAccountId
      );

      if (dbUser) {
        appToken.id = dbUser.id;
        appToken.lineId = dbUser.lineId;
        appToken.role = dbUser.role || appToken.role || "USER";
        appToken.nexPoint = Number(dbUser.nexPoint || 0);
        appToken.coin = Number(dbUser.coin || 0);
        appToken.name = dbUser.name || appToken.name || "NEXORA User";
        appToken.picture = getSafeSessionImage(
          dbUser.image || (typeof appToken.picture === "string" ? appToken.picture : null)
        );
      }

      return appToken;
    },

    async session({ session, token }) {
      const appToken = token as AppToken;
      const userId = String(appToken.id || "").trim();
      let localProfile = null;

      if (userId) {
        try {
          localProfile = await getLocalProfileByUserId(userId);
        } catch {
          localProfile = null;
        }
      }
      const resolvedName =
        localProfile?.displayName || appToken.name || "NEXORA User";
      const resolvedImage = resolveSessionProfileImage(
        localProfile?.image,
        typeof appToken.picture === "string" ? appToken.picture : null
      );

      if (session.user) {
        session.user.id = userId;
        session.user.lineId = appToken.lineId || userId;
        session.user.role = appToken.role || "USER";
        session.user.authProvider = appToken.authProvider || "line";
        session.user.nexPoint = appToken.nexPoint || 0;
        session.user.coin = appToken.coin || 0;
        session.user.name = resolvedName;
        session.user.image = resolvedImage;
      }

      return session;
    },
  },
};
