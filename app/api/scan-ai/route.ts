import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const res = await fetch(process.env.AI_SCAN_URL!, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const text = await res.text();
    console.log("AI RAW:", text);

    return NextResponse.json(JSON.parse(text));
  } catch (error: any) {
    console.error("AI SCAN ERROR:", error);
    return NextResponse.json(
      {
        error: error?.message || "AI scan failed",
      },
      { status: 500 }
    );
  }
}