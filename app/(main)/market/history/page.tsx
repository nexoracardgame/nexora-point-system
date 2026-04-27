import { getAllLocalDeals } from "@/lib/local-deal-store";
import { formatThaiDateTime } from "@/lib/thai-time";

export default async function MarketHistoryPage() {
  const history = (await getAllLocalDeals())
    .filter((item) => item.status === "completed")
    .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))
    .slice(0, 50);

  return (
    <div className="min-h-screen bg-black p-6 text-white">
      <h1 className="mb-6 text-3xl font-bold">ประวัติการขาย</h1>

      <div className="grid gap-4">
        {history.length === 0 ? (
          <div className="rounded-xl bg-zinc-900 p-4 text-zinc-400">
            ยังไม่มีประวัติการขายในระบบใหม่
          </div>
        ) : (
          history.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-4 rounded-xl bg-zinc-900 p-4"
            >
              <div className="text-sm text-zinc-400">
                {formatThaiDateTime(item.createdAt)}
              </div>

              <div className="font-bold text-green-400">
                {item.buyerName} ซื้อ {item.cardName} ในราคา ฿
                {Number(item.offeredPrice || 0).toLocaleString("th-TH")}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
