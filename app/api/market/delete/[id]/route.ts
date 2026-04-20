import { NextResponse } from "next/server";
import { deleteLocalMarketListing } from "@/lib/local-market-store";

export async function DELETE(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    await deleteLocalMarketListing(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE ERROR:", error);

    return NextResponse.json(
      { error: "Delete failed" },
      { status: 500 }
    );
  }
}
