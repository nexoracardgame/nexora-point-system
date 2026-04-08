"use client";

export default function DealActionButtons({
  dealId,
}: {
  dealId: string;
}) {
  const handleAction = async (action: "accept" | "reject") => {
    const res = await fetch("/api/market/deal-action", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ dealId, action }),
    });

    const data = await res.json();

    if (data.success) {
      alert(
        action === "accept"
          ? "ตอบรับดีลสำเร็จ ✅"
          : "ปฏิเสธดีลแล้ว ❌"
      );
      location.reload();
    } else {
      alert(data.error || "อัปเดตไม่สำเร็จ");
    }
  };

  return (
    <div className="flex gap-3">
      <button
        onClick={() => handleAction("accept")}
        className="rounded-xl bg-emerald-500 px-4 py-2 font-bold text-black"
      >
        ✅ Accept
      </button>

      <button
        onClick={() => handleAction("reject")}
        className="rounded-xl bg-red-500 px-4 py-2 font-bold text-white"
      >
        ❌ Reject
      </button>
    </div>
  );
}