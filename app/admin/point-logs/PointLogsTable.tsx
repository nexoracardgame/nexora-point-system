"use client";

type PointLogRow = {
  id: string;
  lineId: string;
  type: string;
  amount: number;
  point: number;
  createdAt: string;
};

type Props = {
  logs: PointLogRow[];
};

export default function PointLogsTable({ logs }: Props) {
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
            <th style={thLeft}>Line ID</th>
            <th style={thCenter}>ประเภท</th>
            <th style={thCenter}>จำนวน</th>
            <th style={thCenter}>แต้ม</th>
            <th style={thCenter}>เวลา</th>
          </tr>
        </thead>

        <tbody>
          {logs.length === 0 ? (
            <tr>
              <td
                colSpan={5}
                style={{
                  padding: 20,
                  textAlign: "center",
                  color: "#aaa",
                }}
              >
                ไม่พบประวัติการเพิ่มแต้ม
              </td>
            </tr>
          ) : (
            logs.map((log) => (
              <tr
                key={log.id}
                className="hover-row"
                style={{ borderBottom: "1px solid #222" }}
              >
                <td style={tdLeftBreak}>{log.lineId}</td>

                <td style={tdCenter}>
                  <span
                    style={{
                      display: "inline-block",
                      padding: "6px 10px",
                      borderRadius: 999,
                      fontSize: 12,
                      fontWeight: "bold",
                      textTransform: "capitalize",
                      background:
                        log.type === "gold"
                          ? "rgba(212,175,55,0.15)"
                          : log.type === "silver"
                          ? "rgba(180,180,180,0.12)"
                          : "rgba(255,255,255,0.06)",
                      color:
                        log.type === "gold"
                          ? "#d4af37"
                          : log.type === "silver"
                          ? "#d9d9d9"
                          : "#fff",
                      border:
                        log.type === "gold"
                          ? "1px solid rgba(212,175,55,0.3)"
                          : log.type === "silver"
                          ? "1px solid rgba(217,217,217,0.2)"
                          : "1px solid rgba(255,255,255,0.08)",
                    }}
                  >
                    {log.type}
                  </span>
                </td>

                <td style={tdCenter}>{log.amount}</td>

                <td
                  style={{
                    ...tdCenter,
                    color: "#d4af37",
                    fontWeight: "bold",
                  }}
                >
                  {log.point}
                </td>

                <td style={tdCenter}>
                  {new Date(log.createdAt).toLocaleString()}
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

const tdCenter: React.CSSProperties = {
  padding: 12,
  textAlign: "center",
};

const tdLeftBreak: React.CSSProperties = {
  padding: 12,
  textAlign: "left",
  wordBreak: "break-all",
};