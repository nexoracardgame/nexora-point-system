import CommunityClient from "@/app/(main)/community/CommunityClient";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export default function CommunityPage() {
  return <CommunityClient />;
}
