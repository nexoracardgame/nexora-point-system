"use client";

import {
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Props = {
  chartData: {
    date: string;
    count: number;
  }[];
  totalUsers: number;
};

export default function DashboardCharts({ chartData, totalUsers }: Props) {
  return (
    <div className="grid gap-4 xl:grid-cols-[1.35fr_0.8fr]">
      <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-4 sm:p-5">
        <h2 className="text-lg font-black text-white sm:text-xl">สมาชิกใหม่ตามวัน</h2>
        <div className="mt-4 h-[260px] sm:h-[300px]">
          <ResponsiveContainer>
            <LineChart data={chartData}>
              <XAxis dataKey="date" stroke="#9ca3af" />
              <YAxis stroke="#9ca3af" allowDecimals={false} />
              <Tooltip />
              <Line type="monotone" dataKey="count" stroke="#fbbf24" strokeWidth={3} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-4 sm:p-5">
        <h2 className="text-lg font-black text-white sm:text-xl">สมาชิกทั้งหมด</h2>
        <div className="mt-4 h-[240px] sm:h-[300px]">
          <ResponsiveContainer>
            <PieChart>
              <Pie data={[{ name: "Users", value: totalUsers }]} dataKey="value" innerRadius={60} outerRadius={90}>
                <Cell fill="#fbbf24" />
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="text-center text-sm font-bold text-white/72 sm:text-base">
          ทั้งหมด {totalUsers.toLocaleString("th-TH")} คน
        </div>
      </div>
    </div>
  );
}
