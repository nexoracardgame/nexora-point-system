"use client";

import { useRouter } from "next/navigation";
import { useLanguage } from "@/lib/i18n";

export default function VerifySaleButton({
  dealId,
}: {
  dealId: string;
}) {
  const router = useRouter();
  const { t } = useLanguage();

  return (
    <button
      onClick={() => router.push(`/market/deals/${dealId}/verify`)}
      className="w-full rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 px-5 py-3.5 text-base font-black text-white shadow-lg shadow-cyan-500/20 transition hover:scale-[1.02]"
    >
      {t("deals.verify")}
    </button>
  );
}
