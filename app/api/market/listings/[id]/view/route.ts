import { incrementLocalMarketListingViews } from "@/lib/local-market-store";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const updated = await incrementLocalMarketListingViews(id);

  if (!updated) {
    return Response.json(
      {
        success: false,
        error: "Listing not found",
      },
      { status: 404 }
    );
  }

  return Response.json({
    success: true,
    views: updated.views,
  });
}
