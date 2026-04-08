export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";
import { exec } from "child_process";

export async function POST(req: NextRequest) {
  try {
    const data = await req.formData();
    const file = data.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file" }, { status: 400 });
    }

    // save upload เป็น query.jpg ให้ python ใช้
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const scannerDir = path.join(process.cwd(), "scanner");
    const queryPath = path.join(scannerDir, "query.jpg");

    await fs.writeFile(queryPath, buffer);

    // run python
    const result = await new Promise<string>((resolve, reject) => {
      exec(
        "py match_card.py",
        { cwd: scannerDir },
        (error, stdout, stderr) => {
          if (error) return reject(stderr || error.message);
          resolve(stdout);
        }
      );
    });

    // parse Best Match
    const match = result.match(/Best Match:\s*(\d+)\.jpg/);
    const cardNo = match?.[1];

    if (!cardNo) {
      return NextResponse.json(
        { error: "Card not found", raw: result },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      cardNo,
      raw: result,
    });
  } catch (error) {
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}