import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const cardNo = req.nextUrl.searchParams.get("cardNo");

  if (!cardNo) {
    return NextResponse.json(
      { error: "Missing cardNo" },
      { status: 400 }
    );
  }

  try {
    const gasUrl =
      "https://script.google.com/macros/s/AKfycbxqjkZjIurmcAA5YoOvtrtM8rWc_le4Fu8rNCQd0G2HMpfpUXP5Z50WqpCxkeeF1AZDow/exec";

    const res = await fetch(
      `${gasUrl}?cardNo=${encodeURIComponent(cardNo)}`,
      {
        cache: "no-store",
      }
    );

    const data = await res.json();

    console.log("GAS DATA:", data);

    return NextResponse.json(data);
  } catch (error) {
    console.error("CARD API ERROR:", error);

    return NextResponse.json(
      { error: "โหลดข้อมูลการ์ดไม่สำเร็จ" },
      { status: 500 }
    );
  }
}