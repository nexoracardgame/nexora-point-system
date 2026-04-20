import { NextResponse } from "next/server";
import { updateLocalMarketListingPrice } from "@/lib/local-market-store";

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await req.json();

    await updateLocalMarketListingPrice(id, Number(body.price));

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Update failed" },
      { status: 500 }
    );
  }
}
