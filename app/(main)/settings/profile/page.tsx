import { getServerSession } from "next-auth";
import ProfileSettingsClient from "@/app/(main)/settings/profile/ProfileSettingsClient";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export default async function ProfileSettingsPage() {
  const session = await getServerSession(authOptions);
  const userId = String(session?.user?.id || "").trim();

  const profile = userId
    ? await prisma.user.findUnique({
        where: { id: userId },
        select: {
          coverImage: true,
          coverPosition: true,
          displayName: true,
          name: true,
          bio: true,
          lineUrl: true,
          facebookUrl: true,
          image: true,
        },
      })
    : null;

  return <ProfileSettingsClient initialProfile={profile || {}} />;
}
