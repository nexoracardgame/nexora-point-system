import { prisma } from "@/lib/prisma";

export default async function TestDbPage() {
  const count = await prisma.marketPost.count();

  return (
    <div style={{ padding: 40, color: "white" }}>
      DB Connected ✅
      <br />
      Market posts: {count}
    </div>
  );
}