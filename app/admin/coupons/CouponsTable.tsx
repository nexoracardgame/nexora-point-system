"use client";

import type { CouponViewModel } from "@/components/CouponDetailCard";
import { formatThaiDateTime } from "@/lib/thai-time";

type Props = {
  coupons: CouponViewModel[];
};

export default function CouponsTable({ coupons }: Props) {
  return (
    <div style={{ display: "grid", gap: 14 }}>
      {coupons.length === 0 ? (
        <div
          style={{
            padding: 20,
            textAlign: "center",
            color: "#aaa",
            borderRadius: 16,
            border: "1px solid #222",
            background: "#111",
          }}
        >
          ไม่พบคูปอง
        </div>
      ) : (
        coupons.map((coupon) => (
          <div
            key={coupon.id}
            style={{
              border: "1px solid #222",
              borderRadius: 18,
              background: "#111",
              padding: 16,
              display: "grid",
              gap: 14,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={labelStyle}>Coupon Code</div>
                <div style={{ marginTop: 6, fontWeight: 800, wordBreak: "break-all" }}>
                  {coupon.code}
                </div>
              </div>

              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  padding: "8px 12px",
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
                {coupon.statusLabel}
              </span>
            </div>

            <div
              style={{
                display: "grid",
                gap: 12,
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              }}
            >
              <div style={cardStyle}>
                <div style={labelStyle}>สมาชิก</div>
                <div style={valueStyle}>{coupon.userName}</div>
                <div style={{ color: "#8a8a8a", fontSize: 12 }}>{coupon.lineId}</div>
              </div>

              <div style={cardStyle}>
                <div style={labelStyle}>Reward</div>
                <div style={valueStyle}>{coupon.rewardName}</div>
              </div>

              <div style={cardStyle}>
                <div style={labelStyle}>Value</div>
                <div style={valueStyle}>{coupon.valueLabel}</div>
              </div>

              <div style={cardStyle}>
                <div style={labelStyle}>Expiry</div>
                <div style={valueStyle}>{coupon.expiryLabel}</div>
              </div>

              <div style={cardStyle}>
                <div style={labelStyle}>Created</div>
                <div style={valueStyleSmall}>
                  {formatThaiDateTime(coupon.createdAt)}
                </div>
              </div>

              <div style={cardStyle}>
                <div style={labelStyle}>Used At</div>
                <div style={valueStyleSmall}>
                  {coupon.usedAt ? formatThaiDateTime(coupon.usedAt) : "-"}
                </div>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  padding: 12,
  borderRadius: 14,
  border: "1px solid #242424",
  background: "#151515",
};

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  color: "#8a8a8a",
  textTransform: "uppercase",
  letterSpacing: "0.12em",
};

const valueStyle: React.CSSProperties = {
  marginTop: 8,
  fontWeight: 800,
};

const valueStyleSmall: React.CSSProperties = {
  marginTop: 8,
  fontWeight: 700,
  fontSize: 13,
  lineHeight: 1.5,
};
