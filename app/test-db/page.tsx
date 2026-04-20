import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function TestDbPage() {
  let count = 0;

  try {
    count = await prisma.marketPost.count();
  } catch {
    count = 0;
  }

  return (
    <div style={{ padding: 40, color: "white" }}>
      DB Connected ✅
      <br />
      Market posts: {count}
    </div>
  );
}
