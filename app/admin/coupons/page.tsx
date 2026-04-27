import { prisma } from "@/lib/prisma";
import { serializeCouponRecord } from "@/lib/coupon-utils";
import CouponsTable from "./CouponsTable";

type PageProps = {
  searchParams: Promise<{
    q?: string;
    status?: string;
  }>;
};

export default async function AdminCouponsPage({ searchParams }: PageProps) {
  const { q = "", status = "all" } = await searchParams;

  const coupons = await prisma.coupon.findMany({
    where: {
      ...(q
        ? {
            OR: [
              { code: { contains: q } },
              { user: { name: { contains: q } } },
              { user: { displayName: { contains: q } } },
              { user: { lineId: { contains: q } } },
              { reward: { name: { contains: q } } },
            ],
          }
        : {}),
      ...(status === "used" ? { used: true } : {}),
      ...(status === "unused" ? { used: false } : {}),
    },
    include: {
      user: {
        select: {
          id: true,
          lineId: true,
          name: true,
          displayName: true,
          image: true,
        },
      },
      reward: {
        select: {
          id: true,
          name: true,
          imageUrl: true,
          nexCost: true,
          coinCost: true,
        },
      },
    },
    orderBy: [{ used: "asc" }, { createdAt: "desc" }],
  });

  return (
    <div style={{ color: "#fff" }}>
      <h1 style={{ fontSize: 28, fontWeight: "bold", marginBottom: 20 }}>
        Coupons
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
          placeholder="ค้นหา code / ชื่อ / line id / reward"
          style={inputStyle}
        />

        <select
          name="status"
          defaultValue={status}
          style={{ ...inputStyle, maxWidth: 180 }}
        >
          <option value="all">ทั้งหมด</option>
          <option value="used">ใช้งานแล้ว</option>
          <option value="unused">พร้อมใช้งาน</option>
        </select>

        <button type="submit" style={goldBtnStyle}>
          ค้นหา
        </button>
      </form>

      <CouponsTable coupons={coupons.map((coupon) => serializeCouponRecord(coupon))} />
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
