"use client";

type CouponRow = {
  id: string;
  code: string;
  used: boolean;
  createdAt: string;
  usedAt: string | null;
  userName: string | null;
  lineId: string;
  rewardName: string;
};

type Props = {
  coupons: CouponRow[];
};

export default function CouponsTable({ coupons }: Props) {
  return (
    <>
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          tableLayout: "fixed",
          background: "#111",
          borderRadius: 12,
          overflow: "hidden",
        }}
      >
        <thead>
          <tr style={{ borderBottom: "1px solid #333" }}>
            <th style={thLeft}>Code</th>
            <th style={thLeft}>สมาชิก</th>
            <th style={thLeft}>Reward</th>
            <th style={thCenter}>สถานะ</th>
            <th style={thCenter}>สร้างเมื่อ</th>
            <th style={thCenter}>ใช้เมื่อ</th>
          </tr>
        </thead>

        <tbody>
          {coupons.length === 0 ? (
            <tr>
              <td
                colSpan={6}
                style={{
                  padding: 20,
                  textAlign: "center",
                  color: "#aaa",
                }}
              >
                ไม่พบคูปอง
              </td>
            </tr>
          ) : (
            coupons.map((coupon) => (
              <tr
                key={coupon.id}
                className="hover-row"
                style={{ borderBottom: "1px solid #222" }}
              >
                <td style={tdLeftBreak}>{coupon.code}</td>

                <td style={tdLeftBreak}>
                  <div style={{ fontWeight: "bold" }}>
                    {coupon.userName || "-"}
                  </div>
                  <div style={{ color: "#aaa", fontSize: 12 }}>
                    {coupon.lineId}
                  </div>
                </td>

                <td style={tdLeft}>{coupon.rewardName}</td>

                <td style={tdCenter}>
                  <span
                    style={{
                      display: "inline-block",
                      padding: "6px 10px",
                      borderRadius: 999,
                      fontSize: 12,
                      fontWeight: "bold",
                      background: coupon.used
                        ? "rgba(0,180,90,0.15)"
                        : "rgba(212,175,55,0.15)",
                      color: coupon.used ? "#57d68d" : "#d4af37",
                      border: `1px solid ${
                        coupon.used ? "rgba(87,214,141,0.3)" : "rgba(212,175,55,0.3)"
                      }`,
                    }}
                  >
                    {coupon.used ? "ใช้แล้ว" : "ยังไม่ใช้"}
                  </span>
                </td>

                <td style={tdCenter}>
                  {new Date(coupon.createdAt).toLocaleString()}
                </td>

                <td style={tdCenter}>
                  {coupon.usedAt
                    ? new Date(coupon.usedAt).toLocaleString()
                    : "-"}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      <style jsx>{`
        .hover-row:hover {
          background: #1a1a1a;
        }
      `}</style>
    </>
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

const tdLeft: React.CSSProperties = {
  padding: 12,
  textAlign: "left",
};

const tdLeftBreak: React.CSSProperties = {
  padding: 12,
  textAlign: "left",
  wordBreak: "break-all",
};

const tdCenter: React.CSSProperties = {
  padding: 12,
  textAlign: "center",
};