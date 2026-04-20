import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      error: "ระบบคูปองเดิมถูกปิดแล้ว และกำลังย้ายเข้าสู่ระบบใหม่",
    },
    { status: 503 }
  );
}
