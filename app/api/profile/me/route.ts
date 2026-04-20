import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getLocalProfileByUserId } from "@/lib/local-profile-store";

export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = String(session?.user?.id || "").trim();

  if (!userId) {
    return Response.json(
      { error: "Unauthorized" },
      {
        status: 401,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      }
    );
  }

  const profile = await getLocalProfileByUserId(userId);

  return Response.json(
    {
      id: userId,
      name: profile?.displayName || session?.user?.name || "NEXORA User",
      displayName: profile?.displayName || session?.user?.name || "NEXORA User",
      image: profile?.image || session?.user?.image || "/avatar.png",
      coverImage: profile?.coverImage || "/seller-cover.jpg",
      coverPosition: profile?.coverPosition ?? 50,
      bio: profile?.bio || "",
      lineUrl: profile?.lineUrl || "",
      facebookUrl: profile?.facebookUrl || "",
    },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    }
  );
}
