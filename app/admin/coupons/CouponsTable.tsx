"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { CouponViewModel } from "@/components/CouponDetailCard";
import { nexoraAlert, nexoraConfirm } from "@/lib/nexora-dialog";
import { formatThaiDateTime } from "@/lib/thai-time";

type Props = {
  coupons: CouponViewModel[];
};

function publishCouponRollbackUpdated() {
  if (typeof window === "undefined") return;

  const timestamp = String(Date.now());
  window.dispatchEvent(new CustomEvent("nexora:rewards-updated"));

  try {
    window.localStorage.setItem("nexora:rewards-updated", timestamp);
    window.sessionStorage.removeItem("nexora:view:redeem-coupons");
  } catch {
    return;
  }
}

function getStatusStyle(coupon: CouponViewModel): React.CSSProperties {
  if (coupon.isReversed) {
    return {
      background: "rgba(248,113,113,0.12)",
      color: "#fca5a5",
      border: "1px solid rgba(248,113,113,0.28)",
    };
  }

  if (coupon.used) {
    return {
      background: "rgba(0,180,90,0.15)",
      color: "#57d68d",
      border: "1px solid rgba(87,214,141,0.3)",
    };
  }

  return {
    background: "rgba(212,175,55,0.15)",
    color: "#d4af37",
    border: "1px solid rgba(212,175,55,0.3)",
  };
}

async function readApiPayload(res: Response) {
  const raw = await res.text();
  if (!raw) return {};

  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return { error: raw.slice(0, 240) };
  }
}

function normalizeRollbackError(message: unknown) {
  const text = String(message || "").trim();
  if (!text) return "ย้อนกลับคูปองไม่สำเร็จ";
  if (text === "forbidden") {
    return "บัญชีนี้ไม่มีสิทธิ์แอดมินสำหรับย้อนกลับคูปอง";
  }
  if (text === "unauthorized") {
    return "กรุณาเข้าสู่ระบบแอดมินอีกครั้ง";
  }
  return text;
}

export default function CouponsTable({ coupons }: Props) {
  const router = useRouter();
  const [rows, setRows] = useState(coupons);
  const [rollingBackId, setRollingBackId] = useState<string | null>(null);

  useEffect(() => {
    setRows(coupons);
  }, [coupons]);

  const rollbackCoupon = async (coupon: CouponViewModel) => {
    if (rollingBackId || coupon.used || coupon.isReversed) return;

    const confirmed = await nexoraConfirm({
      title: "ย้อนกลับคูปอง",
      message: `ยืนยันย้อนกลับคูปอง ${coupon.rewardName} ของ ${coupon.userName} หรือไม่ ระบบจะคืน ${coupon.valueLabel} และเพิ่มสต๊อกรางวัลกลับ 1 ชิ้น`,
      tone: "warning",
      confirmText: "ยืนยันย้อนกลับ",
      cancelText: "ยกเลิก",
    });

    if (!confirmed) return;

    try {
      setRollingBackId(coupon.id);
      const res = await fetch("/api/admin/coupons/rollback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ couponId: coupon.id }),
      });
      const data = await readApiPayload(res);

      if (!res.ok || !data?.success) {
        throw new Error(
          normalizeRollbackError(data?.error || data?.detail)
        );
      }

      if (data?.coupon) {
        setRows((current) =>
          current.map((item) =>
            item.id === coupon.id ? (data.coupon as CouponViewModel) : item
          )
        );
      }

      publishCouponRollbackUpdated();
      router.refresh();
      await nexoraAlert({
        title: "ย้อนกลับสำเร็จ",
        message: String(data?.message || "คืนแต้มและสต๊อกเรียบร้อยแล้ว"),
        tone: "success",
      });
    } catch (error) {
      await nexoraAlert({
        title: "ไม่สำเร็จ",
        message: normalizeRollbackError(
          error instanceof Error ? error.message : error
        ),
        tone: "danger",
      });
    } finally {
      setRollingBackId(null);
    }
  };

  return (
    <div style={{ display: "grid", gap: 14 }}>
      {rows.length === 0 ? (
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
        rows.map((coupon) => {
          const isReversed = coupon.isReversed || Boolean(coupon.reversedAt);
          const canRollback = !coupon.used && !isReversed;
          const statusStyle = getStatusStyle({
            ...coupon,
            isReversed,
          });

          return (
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

                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      padding: "8px 12px",
                      borderRadius: 999,
                      fontSize: 12,
                      fontWeight: "bold",
                      ...statusStyle,
                    }}
                  >
                    {coupon.statusLabel}
                  </span>
                  {canRollback ? (
                    <button
                      type="button"
                      onClick={() => void rollbackCoupon(coupon)}
                      disabled={rollingBackId === coupon.id}
                      style={rollbackBtnStyle}
                    >
                      {rollingBackId === coupon.id ? "กำลังย้อนกลับ..." : "ย้อนกลับ"}
                    </button>
                  ) : null}
                </div>
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

                {isReversed ? (
                  <div style={cardStyle}>
                    <div style={labelStyle}>Reversed At</div>
                    <div style={valueStyleSmall}>
                      {coupon.reversedAt ? formatThaiDateTime(coupon.reversedAt) : "-"}
                    </div>
                  </div>
                ) : null}

                {isReversed ? (
                  <div style={cardStyle}>
                    <div style={labelStyle}>Reversed By</div>
                    <div style={{ ...valueStyleSmall, wordBreak: "break-all" }}>
                      {coupon.reversedById || "-"}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          );
        })
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

const rollbackBtnStyle: React.CSSProperties = {
  display: "inline-flex",
  minHeight: 36,
  alignItems: "center",
  justifyContent: "center",
  borderRadius: 999,
  border: "1px solid rgba(248,113,113,0.35)",
  background: "rgba(248,113,113,0.12)",
  color: "#fecaca",
  cursor: "pointer",
  fontSize: 12,
  fontWeight: 800,
  padding: "8px 12px",
};
