import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import MemberActions from "./MemberActions";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function MemberDetailPage({ params }: PageProps) {
  const { id } = await params;

  const user = await prisma.user.findUnique({
    where: { id },
  });

  if (!user) {
    notFound();
  }

  const logs = await prisma.pointLog.findMany({
    where: { lineId: user.lineId },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return (
    <div style={{ color: "#fff" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 20,
        }}
      >
        <h1 style={{ fontSize: 28, fontWeight: "bold", margin: 0 }}>
          👤 รายละเอียดสมาชิก
        </h1>

        <Link
          href="/admin/members"
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            background: "#1a1a1a",
            color: "#fff",
            textDecoration: "none",
            border: "1px solid #333",
          }}
        >
          ← กลับหน้าสมาชิก
        </Link>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
          gap: 16,
          marginBottom: 24,
        }}
      >
        <Card title="ชื่อ" value={user.name || "-"} />
        <Card title="Line ID" value={user.lineId} />
        <Card title="NEX" value={String(user.nexPoint)} gold />
        <Card title="Coin" value={String(user.coin)} />
      </div>

      <MemberActions lineId={user.lineId} />

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
          }}
        >
          ประวัติการเพิ่มแต้ม
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
              <th style={{ padding: 12, textAlign: "left", width: "20%" }}>
                ประเภท
              </th>
              <th style={{ padding: 12, textAlign: "center", width: "15%" }}>
                จำนวน
              </th>
              <th style={{ padding: 12, textAlign: "center", width: "15%" }}>
                แต้ม
              </th>
              <th style={{ padding: 12, textAlign: "center", width: "50%" }}>
                เวลา
              </th>
            </tr>
          </thead>

          <tbody>
            {logs.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
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
              logs.map((log: any) => (
                <tr key={log.id} style={{ borderBottom: "1px solid #222" }}>
                  <td style={{ padding: 12, textTransform: "capitalize" }}>
                    {log.type}
                  </td>
                  <td style={{ padding: 12, textAlign: "center" }}>
                    {log.amount}
                  </td>
                  <td
                    style={{
                      padding: 12,
                      textAlign: "center",
                      color: "#d4af37",
                      fontWeight: "bold",
                    }}
                  >
                    {log.point}
                  </td>
                  <td style={{ padding: 12, textAlign: "center" }}>
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

function Card({
  title,
  value,
  gold,
}: {
  title: string;
  value: string;
  gold?: boolean;
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
      <div style={{ fontSize: 14, color: "#aaa", marginBottom: 10 }}>{title}</div>
      <div
        style={{
          fontSize: 24,
          fontWeight: "bold",
          color: gold ? "#d4af37" : "#fff",
          wordBreak: "break-all",
        }}
      >
        {value}
      </div>
    </div>
  );
}