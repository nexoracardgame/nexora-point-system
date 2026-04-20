import { prisma } from "@/lib/prisma";
import DashboardCharts from "./DashboardCharts";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminDashboardPage() {
  let totalUsers = 0;
  let totalRewards = 0;
  let totalCoupons = 0;
  let usedCoupons = 0;
  let users: Array<{ createdAt: Date; nexPoint: number; coin: number }> = [];
  let latestLogs: any[] = [];

  try {
    [totalUsers, totalRewards, totalCoupons, usedCoupons, users, latestLogs] =
      await Promise.all([
        prisma.user.count(),
        prisma.reward.count(),
        prisma.coupon.count(),
        prisma.coupon.count({
          where: { used: true },
        }),
        prisma.user.findMany({
          orderBy: { createdAt: "asc" },
          select: {
            createdAt: true,
            nexPoint: true,
            coin: true,
          },
        }),
        prisma.pointLog.findMany({
          orderBy: { createdAt: "desc" },
          take: 10,
        }),
      ]);
  } catch {
    totalUsers = 0;
    totalRewards = 0;
    totalCoupons = 0;
    usedCoupons = 0;
    users = [];
    latestLogs = [];
  }

  const totalNex = users.reduce(
  (sum: number, user: any) => sum + user.nexPoint,
  0
);

const totalCoin = users.reduce(
  (sum: number, user: any) => sum + user.coin,
  0
);

  const groupedMap = new Map<string, number>();

  for (const user of users) {
    const date = new Date(user.createdAt).toLocaleDateString("th-TH");
    groupedMap.set(date, (groupedMap.get(date) || 0) + 1);
  }

  const chartData = Array.from(groupedMap.entries()).map(([date, count]) => ({
    date,
    count,
  }));

  return (
    <div>
      <h1
        style={{
          fontSize: 28,
          fontWeight: "bold",
          marginBottom: 24,
          color: "#fff",
        }}
      >
        📊 Dashboard
      </h1>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(6, minmax(0, 1fr))",
          gap: 16,
          marginBottom: 24,
        }}
      >
        <StatCard title="สมาชิกทั้งหมด" value={totalUsers} />
        <StatCard title="ของรางวัลทั้งหมด" value={totalRewards} />
        <StatCard title="คูปองทั้งหมด" value={totalCoupons} />
        <StatCard title="คูปองใช้แล้ว" value={usedCoupons} />
        <StatCard title="NEX รวม" value={totalNex} />
        <StatCard title="Coin รวม" value={totalCoin} />
      </div>

      <div style={{ marginBottom: 24 }}>
        <DashboardCharts chartData={chartData} totalUsers={totalUsers} />
      </div>

      <div
        style={{
          background: "#111",
          border: "1px solid #222",
          borderRadius: 16,
          padding: 20,
        }}
      >
        <h2
          style={{
            fontSize: 20,
            marginBottom: 16,
            color: "#fff",
          }}
        >
          ⚡ Point Log ล่าสุด
        </h2>

        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            tableLayout: "fixed",
          }}
        >
          <thead>
            <tr style={{ borderBottom: "1px solid #333" }}>
              <th style={thLeft}>Line ID</th>
              <th style={thCenter}>ประเภท</th>
              <th style={thCenter}>จำนวน</th>
              <th style={thCenter}>แต้ม</th>
              <th style={thCenter}>เวลา</th>
            </tr>
          </thead>

          <tbody>
            {latestLogs.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  style={{
                    padding: 16,
                    textAlign: "center",
                    color: "#aaa",
                  }}
                >
                  ยังไม่มีประวัติการเพิ่มแต้ม
                </td>
              </tr>
            ) : (
              latestLogs.map((log: any) => (
                <tr
                  key={log.id}
                  style={{ borderBottom: "1px solid #222" }}
                >
                  <td style={tdLeftBreak}>{log.lineId}</td>

                  <td style={tdCenter}>
                    <span
                      style={{
                        textTransform: "capitalize",
                        padding: "6px 10px",
                        borderRadius: 999,
                        background:
                          log.type === "gold"
                            ? "rgba(212,175,55,0.15)"
                            : "rgba(255,255,255,0.06)",
                        color:
                          log.type === "gold" ? "#d4af37" : "#fff",
                        border:
                          log.type === "gold"
                            ? "1px solid rgba(212,175,55,0.3)"
                            : "1px solid rgba(255,255,255,0.08)",
                        fontSize: 12,
                        fontWeight: "bold",
                      }}
                    >
                      {log.type}
                    </span>
                  </td>

                  <td style={tdCenter}>{log.amount}</td>

                  <td
                    style={{
                      ...tdCenter,
                      color: "#d4af37",
                      fontWeight: "bold",
                    }}
                  >
                    {log.point}
                  </td>

                  <td style={tdCenter}>
                    {new Date(log.createdAt).toLocaleString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
}: {
  title: string;
  value: number;
}) {
  return (
    <div
      style={{
        background: "#111",
        border: "1px solid #222",
        borderRadius: 16,
        padding: 20,
      }}
    >
      <div
        style={{
          fontSize: 14,
          color: "#aaa",
          marginBottom: 10,
        }}
      >
        {title}
      </div>

      <div
        style={{
          fontSize: 34,
          fontWeight: "bold",
          color: "#d4af37",
        }}
      >
        {value}
      </div>
    </div>
  );
}

const thLeft: React.CSSProperties = {
  padding: 12,
  textAlign: "left",
};

const thCenter: React.CSSProperties = {
  padding: 12,
  textAlign: "center",
};

const tdCenter: React.CSSProperties = {
  padding: 12,
  textAlign: "center",
};

const tdLeftBreak: React.CSSProperties = {
  padding: 12,
  textAlign: "left",
  wordBreak: "break-all",
};
