"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

type UserRow = {
  id: string;
  name: string | null;
  lineId: string;
  nexPoint: number;
  coin: number;
  createdAt: string;
};

type Props = {
  users: UserRow[];
};

export default function MembersTable({ users }: Props) {
  const router = useRouter();

  const [nexInputs, setNexInputs] = useState<Record<string, string>>({});
  const [coinInputs, setCoinInputs] = useState<Record<string, string>>({});
  const [loadingId, setLoadingId] = useState<string | null>(null);

 const updateMember = async (lineId: string) => {
  const nexValue = nexInputs[lineId];
  const coinValue = coinInputs[lineId];

  if (!nexValue && !coinValue) {
    alert("กรอก NEX หรือ COIN");
    return;
  }

  try {
    setLoadingId(lineId);

    // ✅ ใช้ API เดิมของระบบสำหรับ NEX
    if (nexValue && Number(nexValue) !== 0) {
      const nexRes = await fetch("/api/point/add", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          lineId,
          type: "silver",
          amount: Number(nexValue),
        }),
      });

      const nexData = await nexRes.json();

      if (!nexRes.ok) {
        alert(nexData.error || "เพิ่ม NEX ไม่สำเร็จ");
        return;
      }
    }

    // ✅ ใช้ API เดิมของระบบสำหรับ COIN
    if (coinValue && Number(coinValue) !== 0) {
      const coinRes = await fetch("/api/coin/update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          lineId,
          amount: Math.abs(Number(coinValue)),
          action: Number(coinValue) >= 0 ? "add" : "subtract",
        }),
      });

      const coinData = await coinRes.json();

      if (!coinRes.ok) {
        alert(coinData.error || "เพิ่ม COIN ไม่สำเร็จ");
        return;
      }
    }

    setNexInputs((prev) => ({ ...prev, [lineId]: "" }));
    setCoinInputs((prev) => ({ ...prev, [lineId]: "" }));

    router.refresh();
  } catch (error) {
    console.error("UPDATE MEMBER ERROR:", error);
    alert("อัปเดตไม่สำเร็จ");
  } finally {
    setLoadingId(null);
  }
};

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
            <th style={{ padding: 12, width: "14%", textAlign: "left" }}>ชื่อ</th>
            <th style={{ padding: 12, width: "20%", textAlign: "left" }}>
              Line ID
            </th>
            <th style={{ padding: 12, width: "8%", textAlign: "center" }}>NEX</th>
            <th style={{ padding: 12, width: "8%", textAlign: "center" }}>Coin</th>
            <th style={{ padding: 12, width: "16%", textAlign: "center" }}>
              สมัครเมื่อ
            </th>
            <th style={{ padding: 12, width: "34%", textAlign: "center" }}>
              จัดการแต้ม
            </th>
          </tr>
        </thead>

        <tbody>
          {users.map((user) => (
            <tr
              key={user.id}
              className="hover-row"
              style={{ borderBottom: "1px solid #222" }}
            >
              <td style={{ padding: 12 }}>
                <Link
                  href={`/admin/members/${user.id}`}
                  style={{
                    color: "#fff",
                    textDecoration: "none",
                    fontWeight: "bold",
                  }}
                >
                  {user.name || "-"}
                </Link>
              </td>

              <td style={{ padding: 12, wordBreak: "break-all" }}>
                {user.lineId}
              </td>

              <td
                style={{
                  padding: 12,
                  textAlign: "center",
                  color: "#d4af37",
                  fontWeight: "bold",
                }}
              >
                {user.nexPoint}
              </td>

              <td
                style={{
                  padding: 12,
                  textAlign: "center",
                  fontWeight: "bold",
                  color: "#38bdf8",
                }}
              >
                {user.coin}
              </td>

              <td style={{ padding: 12, textAlign: "center" }}>
                {new Date(user.createdAt).toLocaleString()}
              </td>

              <td style={{ padding: 12 }}>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr auto",
                    gap: 8,
                  }}
                >
                  <input
                    value={nexInputs[user.lineId] || ""}
                    onChange={(e) =>
                      setNexInputs((prev) => ({
                        ...prev,
                        [user.lineId]: e.target.value,
                      }))
                    }
                    placeholder="NEX"
                    type="number"
                    style={inputStyle}
                  />

                  <input
                    value={coinInputs[user.lineId] || ""}
                    onChange={(e) =>
                      setCoinInputs((prev) => ({
                        ...prev,
                        [user.lineId]: e.target.value,
                      }))
                    }
                    placeholder="COIN"
                    type="number"
                    style={inputStyle}
                  />

                  <button
                    onClick={() => updateMember(user.lineId)}
                    disabled={loadingId === user.lineId}
                    style={goldBtnStyle}
                  >
                    {loadingId === user.lineId ? "..." : "ยืนยัน"}
                  </button>
                </div>
              </td>
            </tr>
          ))}
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

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 8,
  border: "1px solid #333",
  background: "#151515",
  color: "#fff",
  outline: "none",
};

const goldBtnStyle: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 8,
  border: "none",
  background: "#d4af37",
  color: "#000",
  fontWeight: "bold",
  cursor: "pointer",
};