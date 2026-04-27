"use client";

import { Share2, Copy, Check } from "lucide-react";
import { useEffect, useState } from "react";

type Props = {
  userId: string;
  displayName: string;
  className?: string;
};

function buildProfileUrl(userId: string) {
  if (typeof window === "undefined") {
    return `/profile/${userId}`;
  }

  return `${window.location.origin}/profile/${userId}`;
}

export default function ProfileShareButton({
  userId,
  displayName,
  className = "",
}: Props) {
  const [profileUrl, setProfileUrl] = useState(`/profile/${userId}`);
  const [copied, setCopied] = useState(false);
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    setProfileUrl(buildProfileUrl(userId));
  }, [userId]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(profileUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
      alert("คัดลอกลิงก์ไม่สำเร็จ");
    }
  };

  const handleShare = async () => {
    if (!navigator.share) {
      await handleCopy();
      return;
    }

    try {
      setSharing(true);
      await navigator.share({
        title: `${displayName} on NEXORA`,
        text: `ดูโปรไฟล์ของ ${displayName} บน NEXORA`,
        url: profileUrl,
      });
    } catch {
      return;
    } finally {
      setSharing(false);
    }
  };

  return (
    <div className={`flex flex-wrap items-center gap-3 ${className}`}>
      <button
        type="button"
        onClick={() => void handleShare()}
        disabled={sharing}
        className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-[17px] border border-amber-300/24 bg-[linear-gradient(180deg,rgba(251,191,36,0.18)_0%,rgba(251,191,36,0.08)_100%)] px-4 text-sm font-black text-amber-100 shadow-[0_16px_35px_rgba(251,191,36,0.12)] transition hover:scale-[1.03] hover:bg-amber-300/20 disabled:cursor-wait disabled:opacity-70"
      >
        <Share2 className="h-4 w-4" />
        {sharing ? "กำลังแชร์..." : "แชร์โปรไฟล์"}
      </button>

      <button
        type="button"
        onClick={() => void handleCopy()}
        className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-[17px] border border-white/14 bg-white/[0.06] px-4 text-sm font-black text-white/88 transition hover:scale-[1.03] hover:bg-white/[0.10]"
      >
        {copied ? <Check className="h-4 w-4 text-emerald-300" /> : <Copy className="h-4 w-4" />}
        {copied ? "คัดลอกแล้ว" : "คัดลอกลิงก์"}
      </button>
    </div>
  );
}
