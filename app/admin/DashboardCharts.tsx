"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

type Props = {
  chartData: {
    date: string;
    count: number;
  }[];
  totalUsers: number;
};

export default function DashboardCharts({
  chartData,
  totalUsers,
}: Props) {
  const usersWithPoint =
    chartData.length > 0 ? chartData[chartData.length - 1]?.count ?? 0 : 0;

  const pieData = [
    { name: "สมาชิกทั้งหมด", value: totalUsers },
  ];

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "2fr 1fr",
        gap: 16,
      }}
    >
      <div
        style={{
          background: "#111",
          border: "1px solid #222",
          borderRadius: 16,
          padding: 20,
          minHeight: 360,
        }}
      >
        <h2
          style={{
            fontSize: 18,
            marginBottom: 16,
            color: "#fff",
          }}
        >
          สมาชิกใหม่ตามวัน
        </h2>

        <div style={{ width: "100%", height: 280 }}>
          <ResponsiveContainer>
            <LineChart data={chartData}>
              <XAxis dataKey="date" stroke="#aaa" />
              <YAxis stroke="#aaa" allowDecimals={false} />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="count"
                stroke="#d4af37"
                strokeWidth={3}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div
        style={{
          background: "#111",
          border: "1px solid #222",
          borderRadius: 16,
          padding: 20,
          minHeight: 360,
        }}
      >
        <h2
          style={{
            fontSize: 18,
            marginBottom: 16,
            color: "#fff",
          }}
        >
          สมาชิกทั้งหมด
        </h2>

        <div style={{ width: "100%", height: 260 }}>
          <ResponsiveContainer>
            <PieChart>
              <Pie
                data={pieData}
                dataKey="value"
                nameKey="name"
                innerRadius={60}
                outerRadius={90}
              >
                <Cell fill="#d4af37" />
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div style={{ textAlign: "center", color: "#fff" }}>
          ทั้งหมด {totalUsers} คน
        </div>
      </div>
    </div>
  );
}