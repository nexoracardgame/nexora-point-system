export default function NotFound() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        background: "#0a0a0a",
        color: "#fff",
        padding: 24,
        textAlign: "center",
      }}
    >
      <div>
        <h1>ไม่พบคูปอง</h1>
        <p>รหัสคูปองนี้ไม่มีอยู่ในระบบ</p>
      </div>
    </div>
  );
}