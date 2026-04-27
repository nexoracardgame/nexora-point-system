import { getServerSession } from "next-auth";
import ProfileSettingsClient from "@/app/(main)/settings/profile/ProfileSettingsClient";
import { authOptions } from "@/lib/auth";
import { getLocalProfileByUserId } from "@/lib/local-profile-store";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export default async function ProfileSettingsPage() {
  const session = await getServerSession(authOptions);
  const userId = String(session?.user?.id || "").trim();
  const sessionUser = (session?.user ||
    {}) as {
    name?: string | null;
    image?: string | null;
  };

  const profile = userId ? await getLocalProfileByUserId(userId) : null;

  const initialProfile =
    profile ||
    {
      displayName: sessionUser.name || "",
      name: sessionUser.name || "",
      username: "",
      image: sessionUser.image || "/avatar.png",
      coverImage: "/seller-cover.jpg",
      coverPosition: 50,
      bio: "",
      lineUrl: "",
      facebookUrl: "",
    };

  return <ProfileSettingsClient initialProfile={initialProfile} />;
}
