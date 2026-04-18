"use client";

import { useRouter } from "next/navigation";

export default function VerifySaleButton({
  dealId,
}: {
  dealId: string;
}) {
  const router = useRouter();

  return (
    <button
      onClick={() => router.push(`/market/deals/${dealId}/verify`)}
      className="w-full rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 px-5 py-3 font-bold text-white shadow-lg shadow-cyan-500/20 transition hover:scale-[1.02]"
    >
      🔐 Verify Serial & Close Sale
    </button>
  );
}