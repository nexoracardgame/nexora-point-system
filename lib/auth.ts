import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import LineProvider from "next-auth/providers/line";
import { JWT } from "next-auth/jwt";
import { getLocalProfileByUserId } from "@/lib/local-profile-store";
import { prisma } from "@/lib/prisma";
import {
  createProviderProfileImageSnapshot,
  isDefaultProfileImageUrl,
  isProviderProfileImageUrl,
} from "@/lib/profile-image-snapshot";
import { syncUserIdentityEverywhere } from "@/lib/user-identity-sync";

type AuthProvider = "line" | "google";

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

function isAuthProvider(value?: string | null): value is AuthProvider {
  return value === "line" || value === "google";
}

function getAuthProvider(value?: string | null): AuthProvider {
  return isAuthProvider(value) ? value : "line";
}

function getProviderIdentity(
  provider: AuthProvider,
  profile: OAuthProfile,
  fallbackSubject?: string | null
) {
  const subject = String(profile.sub || fallbackSubject || "").trim();

  if (!subject) {
    return "";
  }

  return provider === "google" ? `google:${subject}` : subject;
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

async function ensureDbUser(
  appToken: AppToken,
  profile: OAuthProfile,
  provider: AuthProvider
) {
  const providerLineId = getProviderIdentity(provider, profile);
  const lineId = String(appToken.lineId || providerLineId).trim();

  if (!lineId) {
    return null;
  }

  const safeName = String(appToken.name || profile.name || "NEXORA User").trim();
  const providerImage = getProviderImage(appToken, profile);

  try {
    const existingUser = await prisma.user.findUnique({
      where: { lineId },
      select: {
        id: true,
        lineId: true,
        name: true,
        image: true,
        displayName: true,
        role: true,
        nexPoint: true,
        coin: true,
      },
    });

    if (existingUser) {
      const existingImage = String(existingUser.image || "").trim();
      const stableImage = shouldRepairStoredProfileImage(existingUser.image)
        ? await getStableInitialProfileImage(
            providerImage,
            lineId,
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

      if (needsPatch) {
        const patchedUser = await prisma.user.update({
          where: { id: existingUser.id },
          data: {
            name: String(existingUser.name || "").trim() ? undefined : safeName,
            displayName: String(existingUser.displayName || "").trim()
              ? undefined
              : safeName,
            image: nextImage,
          },
          select: {
            id: true,
            lineId: true,
            name: true,
            displayName: true,
            image: true,
            role: true,
            nexPoint: true,
            coin: true,
          },
        });

        if (nextImage) {
          await syncUserIdentityEverywhere({
            userId: patchedUser.id,
            lineId: patchedUser.lineId,
            name: patchedUser.displayName || patchedUser.name || safeName,
            image: patchedUser.image,
          }).catch(() => undefined);
        }

        return {
          ...patchedUser,
          name: patchedUser.displayName || patchedUser.name,
        } satisfies DbUserSnapshot;
      }

      return {
        id: existingUser.id,
        lineId: existingUser.lineId,
        name: existingUser.displayName || existingUser.name,
        image: existingUser.image,
        role: existingUser.role,
        nexPoint: existingUser.nexPoint,
        coin: existingUser.coin,
      } satisfies DbUserSnapshot;
    }

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
      select: {
        id: true,
        lineId: true,
        name: true,
        displayName: true,
        image: true,
        role: true,
        nexPoint: true,
        coin: true,
      },
    });

    return createdUser satisfies DbUserSnapshot;
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

  secret: process.env.NEXTAUTH_SECRET,

  session: {
    strategy: "jwt",
  },

  callbacks: {
    async signIn({ account, profile }) {
      const provider = getAuthProvider(account?.provider);
      const oauthProfile = (profile || {}) as OAuthProfile;
      const lineId = getProviderIdentity(
        provider,
        oauthProfile,
        account?.providerAccountId
      );

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

      if (oauthProfile.sub || providerAccountId) {
        const providerLineId = getProviderIdentity(
          provider,
          oauthProfile,
          providerAccountId
        );

        appToken.authProvider = provider;
        appToken.lineId = providerLineId;
        appToken.id = appToken.id || providerLineId;
        appToken.name = appToken.name || oauthProfile.name || "NEXORA User";
        appToken.picture = getSafeSessionImage(
          typeof appToken.picture === "string"
            ? appToken.picture
            : oauthProfile.picture
        );
      }

      const lineId = appToken.lineId || getProviderIdentity(provider, oauthProfile);
      appToken.id = appToken.id || lineId || "";
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
        appToken.authProvider
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
        session.user.nexPoint = appToken.nexPoint || 0;
        session.user.coin = appToken.coin || 0;
        session.user.name = resolvedName;
        session.user.image = resolvedImage;
      }

      return session;
    },
  },
};
