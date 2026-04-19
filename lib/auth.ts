import { NextAuthOptions } from "next-auth";
import LineProvider from "next-auth/providers/line";
import { JWT } from "next-auth/jwt";
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

function getSafeSessionImage(image?: string | null) {
  const raw = String(image || "").trim();

  if (!raw) return "/avatar.png";

  if (raw.startsWith("data:image/")) {
    return "/avatar.png";
  }

  return raw;
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

      const existingUser = await prisma.user.findUnique({
        where: { lineId },
      });

      if (!existingUser) {
        await prisma.user.create({
          data: {
            lineId,
            name: lineProfile.name || "LINE User",
            image: lineProfile.picture || "",
          },
        });
      }

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
      }

      const lineId = appToken.lineId || lineProfile.sub;

      if (lineId) {
        const dbUser = await prisma.user.findUnique({
          where: { lineId },
          select: {
            id: true,
            lineId: true,
            role: true,
            nexPoint: true,
            coin: true,
            name: true,
            displayName: true,
            image: true,
          },
        });

        if (dbUser) {
          appToken.id = dbUser.id;
          appToken.lineId = dbUser.lineId;
          appToken.role = dbUser.role;
          appToken.nexPoint = dbUser.nexPoint;
          appToken.coin = dbUser.coin;
          appToken.name = dbUser.displayName || dbUser.name || "NEXORA User";
          appToken.picture = getSafeSessionImage(dbUser.image);
        }
      }

      return appToken;
    },

    async session({ session, token }) {
      const appToken = token as AppToken;

      if (session.user) {
        session.user.id = appToken.id || "";
        session.user.lineId = appToken.lineId || "";
        session.user.role = appToken.role || "USER";
        session.user.nexPoint = appToken.nexPoint || 0;
        session.user.coin = appToken.coin || 0;
        session.user.name = appToken.name || "NEXORA User";
        session.user.image = appToken.picture || "/avatar.png";
      }

      return session;
    },
  },
};
