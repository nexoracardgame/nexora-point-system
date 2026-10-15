import { prisma } from "./prisma";
import type { BattleForfeit } from "./battle-forfeit";

type RankTransaction = Pick<typeof prisma, "$executeRawUnsafe">;
export async function recordForfeitRank(tx: RankTransaction, key: string, result: BattleForfeit) {
  await tx.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "BattleForfeitResult" ("key" TEXT PRIMARY KEY, "winnerId" TEXT NOT NULL, "loserId" TEXT NOT NULL, "at" TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
  await tx.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "TriadRankProfile" ("userId" TEXT PRIMARY KEY, "name" TEXT NOT NULL DEFAULT 'PLAYER', "image" TEXT NOT NULL DEFAULT '/avatar.png', "wins" INTEGER NOT NULL DEFAULT 0, "losses" INTEGER NOT NULL DEFAULT 0, "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
  const inserted = await tx.$executeRawUnsafe(`INSERT INTO "BattleForfeitResult" ("key","winnerId","loserId") VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`, key, result.winner.id, result.loser.id);
  if (!inserted) return;
  const updates = [{ participant: result.winner, win: true }, { participant: result.loser, win: false }].sort((a, b) => a.participant.id.localeCompare(b.participant.id));
  for (const { participant, win } of updates) {
    await tx.$executeRawUnsafe(`INSERT INTO "TriadRankProfile" ("userId","name","image","wins","losses") VALUES ($1,$2,$3,$4,$5) ON CONFLICT ("userId") DO UPDATE SET "name"=EXCLUDED."name", "image"=EXCLUDED."image", "wins"="TriadRankProfile"."wins"+EXCLUDED."wins", "losses"="TriadRankProfile"."losses"+EXCLUDED."losses", "updatedAt"=NOW()`, participant.id, participant.name, participant.image, win ? 1 : 0, win ? 0 : 1);
  }
}
