"use client";

export default function RequestDealButton({
  cardId,
}: {
  cardId: string;
}) {
  const handleRequest = async () => {
    const offeredPrice = prompt("เสนอราคาดีล (NEX)");
    if (!offeredPrice) return;

    const res = await fetch("/api/market/deal-request", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        cardId,
        buyerId: "CURRENT_USER_ID",
        sellerId: "SELLER_ID",
        offeredPrice,
      }),
    });

    const data = await res.json();

    if (data.success) {
      alert("ส่งคำขอนัดดีลสำเร็จ 🤝");
    } else {
      alert(data.error || "ส่งไม่สำเร็จ");
    }
  };

  return (
    <button
      onClick={handleRequest}
      className="rounded-2xl bg-gradient-to-r from-orange-400 to-amber-500 px-6 py-3 font-bold text-black"
    >
      🤝 Request Deal
    </button>
  );
}