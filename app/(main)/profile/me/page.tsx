import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function MyProfileRedirect() {
  const session = await getServerSession(authOptions);

  const userId = (session?.user as any)?.id;

  if (!userId) {
    redirect("/login");
  }

  redirect(`/profile/${userId}`);
}