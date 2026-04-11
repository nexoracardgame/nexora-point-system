"use client";

export default function CancelDealButton({
  dealId,
}: {
  dealId: string;
}) {
  return (
    <button
      onClick={async () => {
        const ok = confirm("ยกเลิกดีลนี้?");
        if (!ok) return;

        const res = await fetch(`/api/market/deal-request/${dealId}`, {
          method: "DELETE",
        });

        if (res.ok) {
          window.location.reload();
        } else {
          alert("ยกเลิกไม่สำเร็จ");
        }
      }}
      className="w-full rounded-2xl bg-red-500 px-6 py-3 font-bold text-white"
    >
      Cancel Deal
    </button>
  );
}