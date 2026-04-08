import { NextAuthOptions } from "next-auth";
import LineProvider from "next-auth/providers/line";
import { prisma } from "@/lib/prisma";

function getSafeSessionImage(image?: string | null) {
  const raw = String(image || "").trim();

  if (!raw) return "/avatar.png";

  // ❌ base64 ห้ามใส่ JWT เด็ดขาด
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
      const lineId = profile?.sub;
      if (!lineId) return false;

      const existingUser = await prisma.user.findUnique({
        where: { lineId },
      });

      if (!existingUser) {
        await prisma.user.create({
          data: {
            lineId,
            name: profile?.name || "LINE User",
            image: (profile as any)?.picture || "",
          },
        });
      }

      return true;
    },

    async jwt({ token, profile }) {
      if (profile?.sub) {
        (token as any).lineId = profile.sub;
      }

      const lineId =
        (token as any).lineId ||
        (profile as any)?.sub;

      if (lineId) {
        const dbUser = await prisma.user.findUnique({
          where: { lineId: lineId as string },
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
          (token as any).id = dbUser.id;
          (token as any).lineId = dbUser.lineId;
          (token as any).role = dbUser.role;
          (token as any).nexPoint = dbUser.nexPoint;
          (token as any).coin = dbUser.coin;

          token.name =
            dbUser.displayName ||
            dbUser.name ||
            "NEXORA User";

          // ✅ ใช้รูปจริงตั้งแต่ first paint
          token.picture = getSafeSessionImage(dbUser.image);
        }
      }

      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = (token as any).id;
        (session.user as any).lineId = (token as any).lineId;
        (session.user as any).role = (token as any).role;
        (session.user as any).nexPoint = (token as any).nexPoint;
        (session.user as any).coin = (token as any).coin;

        session.user.name =
          token.name || "NEXORA User";

        // ✅ รูปจริงมาเลยตั้งแต่ render แรก
        session.user.image =
          (token.picture as string) ||
          "/avatar.png";
      }

      return session;
    },
  },
};