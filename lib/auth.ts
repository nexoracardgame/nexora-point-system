import { NextAuthOptions } from "next-auth";
import LineProvider from "next-auth/providers/line";
import { JWT } from "next-auth/jwt";
import { getLocalProfileByUserId } from "@/lib/local-profile-store";
import { prisma } from "@/lib/prisma";

type LineProfile = {
  sub?: string;
  name?: string;
  picture?: string;
};

type SessionUpdatePayload = {
  name?: string | null;
  image?: string | null;
};

type AppToken = JWT & {
  id?: string;
  lineId?: string;
  role?: string;
  nexPoint?: number;
  coin?: number;
};

type DbUserSnapshot = {
  id: string;
  lineId: string;
  name: string | null;
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

async function ensureDbUser(appToken: AppToken, lineProfile: LineProfile) {
  const lineId = String(appToken.lineId || lineProfile.sub || "").trim();

  if (!lineId) {
    return null;
  }

  const safeName = String(appToken.name || lineProfile.name || "NEXORA User").trim();
  const safeImage = getSafeSessionImage(
    typeof appToken.picture === "string" ? appToken.picture : lineProfile.picture
  );

  try {
    const dbUser = await prisma.user.upsert({
      where: { lineId },
      update: {
        name: safeName,
        image: safeImage,
      },
      create: {
        lineId,
        name: safeName,
        image: safeImage,
        role: "USER",
      },
      select: {
        id: true,
        lineId: true,
        name: true,
        image: true,
        role: true,
        nexPoint: true,
        coin: true,
      },
    });

    return dbUser satisfies DbUserSnapshot;
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
  ],

  secret: process.env.NEXTAUTH_SECRET,

  session: {
    strategy: "jwt",
  },

  callbacks: {
    async signIn({ profile }) {
      const lineProfile = (profile || {}) as LineProfile;
      const lineId = lineProfile.sub;

      if (!lineId) return false;

      return true;
    },

    async jwt({ token, profile, trigger, session }) {
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

      const lineProfile = (profile || {}) as LineProfile;

      if (lineProfile.sub) {
        appToken.lineId = lineProfile.sub;
        appToken.id = appToken.id || lineProfile.sub;
        appToken.name = appToken.name || lineProfile.name || "NEXORA User";
        appToken.picture = getSafeSessionImage(
          typeof appToken.picture === "string"
            ? appToken.picture
            : lineProfile.picture
        );
      }

      const lineId = appToken.lineId || lineProfile.sub;
      appToken.id = appToken.id || lineId || "";
      appToken.role = appToken.role || "USER";
      appToken.nexPoint = appToken.nexPoint || 0;
      appToken.coin = appToken.coin || 0;
      appToken.name = appToken.name || "NEXORA User";
      appToken.picture = getSafeSessionImage(
        typeof appToken.picture === "string" ? appToken.picture : null
      );

      const dbUser = await ensureDbUser(appToken, lineProfile);

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
      const resolvedImage = getSafeSessionImage(
        localProfile?.image || appToken.picture || "/avatar.png"
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
