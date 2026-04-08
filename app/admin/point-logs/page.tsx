import { prisma } from "@/lib/prisma";
import PointLogsTable from "./PointLogsTable";

type PageProps = {
  searchParams: Promise<{
    q?: string;
    type?: string;
  }>;
};

export default async function PointLogsPage({ searchParams }: PageProps) {
  const { q = "", type = "all" } = await searchParams;

  const logs = await prisma.pointLog.findMany({
    where: {
      ...(q
        ? {
            lineId: {
              contains: q,
            },
          }
        : {}),
      ...(type !== "all"
        ? {
            type,
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <div style={{ color: "#fff" }}>
      <h1 style={{ fontSize: 28, fontWeight: "bold", marginBottom: 20 }}>
        ⚡ Point Logs
      </h1>

      <form
        method="GET"
        style={{
          display: "flex",
          gap: 12,
          marginBottom: 20,
          flexWrap: "wrap",
        }}
      >
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="ค้นหา Line ID"
          style={inputStyle}
        />

        <select
          name="type"
          defaultValue={type}
          style={{ ...inputStyle, maxWidth: 180 }}
        >
          <option value="all">ทั้งหมด</option>
          <option value="bronze">bronze</option>
          <option value="silver">silver</option>
          <option value="gold">gold</option>
        </select>

        <button type="submit" style={goldBtnStyle}>
          ค้นหา
        </button>
      </form>

      <PointLogsTable
        logs={logs.map((log: any) => ({
          id: log.id,
          lineId: log.lineId,
          type: log.type,
          amount: log.amount,
          point: log.point,
          createdAt: log.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 220,
  padding: "12px 14px",
  borderRadius: 10,
  border: "1px solid #333",
  background: "#151515",
  color: "#fff",
  outline: "none",
};

const goldBtnStyle: React.CSSProperties = {
  padding: "12px 18px",
  borderRadius: 10,
  border: "none",
  background: "#d4af37",
  color: "#000",
  fontWeight: "bold",
  cursor: "pointer",
};