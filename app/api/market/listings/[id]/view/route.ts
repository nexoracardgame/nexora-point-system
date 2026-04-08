import { prisma } from "@/lib/prisma";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const updated = await prisma.marketListing.update({
    where: {
      id,
    },
    data: {
      views: {
        increment: 1,
      },
    },
    select: {
      views: true,
    },
  });

  return Response.json({
    success: true,
    views: updated.views,
  });
}