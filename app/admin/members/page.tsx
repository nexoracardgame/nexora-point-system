import { prisma } from "@/lib/prisma";
import MembersTable from "./MembersTable";

type PageProps = {
  searchParams: Promise<{
    q?: string;
  }>;
};

export default async function MembersPage({ searchParams }: PageProps) {
  const { q = "" } = await searchParams;

  const users = await prisma.user.findMany({
    where: q
      ? {
          OR: [
            { name: { contains: q } },
            { lineId: { contains: q } },
          ],
        }
      : undefined,
    orderBy: { createdAt: "desc" },
  });

  return (
    <div
      style={{
        padding: 20,
        color: "#fff",
        background: "#000",
        minHeight: "100vh",
        fontFamily: "sans-serif",
      }}
    >
      <h1 style={{ fontSize: 24, marginBottom: 20 }}>👥 สมาชิกทั้งหมด</h1>

      <form
        method="GET"
        style={{
          display: "flex",
          gap: 12,
          marginBottom: 20,
        }}
      >
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="ค้นหาชื่อ หรือ Line ID"
          style={{
            flex: 1,
            padding: "12px 14px",
            borderRadius: 10,
            border: "1px solid #333",
            background: "#111",
            color: "#fff",
            outline: "none",
          }}
        />
        <button
          type="submit"
          style={{
            padding: "12px 18px",
            borderRadius: 10,
            border: "none",
            background: "#d4af37",
            color: "#000",
            fontWeight: "bold",
            cursor: "pointer",
          }}
        >
          ค้นหา
        </button>
      </form>

      <MembersTable
        users={users.map((user: any) => ({
          id: user.id,
          name: user.name,
          lineId: user.lineId,
          nexPoint: user.nexPoint,
          coin: user.coin,
          createdAt: user.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}