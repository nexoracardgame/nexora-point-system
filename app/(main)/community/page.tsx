import CommunityClient from "@/app/(main)/community/CommunityClient";
export default function CommunityPage() {
  return (
    <CommunityClient
      initialFriends={[]}
      initialRequests={[]}
      hasInitialCommunityState={false}
    />
  );
}
