import { prisma } from "@/lib/prisma";

export default async function MarketHistoryPage() {
  const history = await prisma.marketHistory.findMany({
    where: {
      action: "sold",
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 50,
  });

  return (
    <div className="min-h-screen bg-black text-white p-6">
      <h1 className="text-3xl font-bold mb-6">
        📦 ประวัติการขาย
      </h1>

      <div className="grid gap-4">
        {history.map((item) => (
          <div
            key={item.id}
            className="flex items-center gap-4 bg-zinc-900 p-4 rounded-xl"
          >
            <div className="text-sm text-zinc-400">
              {new Date(item.createdAt).toLocaleString()}
            </div>

            <div className="font-bold text-green-400">
              {item.detail}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}