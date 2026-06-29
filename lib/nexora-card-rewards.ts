export type NexoraCoinReward = {
  cardNo: string;
  cardName: string;
  coinValue: number;
  source: "card-image-ocr";
  confidence: "high" | "medium";
};

export type NexoraSingleCardNexReward = {
  cardNo: string;
  nexValue: number;
  sourceUrl: string;
  cardName?: string;
};

export const NEXORA_SINGLE_CARD_REWARD_SOURCE_URL =
  "https://www.nexoracardgame.com/legend-cards";

export const nexoraCoinRewards: NexoraCoinReward[] = [
  { cardNo: "006", cardName: "KREL IGNIVAR", coinValue: 4000, source: "card-image-ocr", confidence: "high" },
  { cardNo: "007", cardName: "KREIA FORCEHEART", coinValue: 2700, source: "card-image-ocr", confidence: "high" },
  { cardNo: "008", cardName: "LYSSARA POSEIDON", coinValue: 2700, source: "card-image-ocr", confidence: "high" },
  { cardNo: "009", cardName: "ELDREN SYLVEN", coinValue: 3000, source: "card-image-ocr", confidence: "high" },
  { cardNo: "010", cardName: "URREK AURON", coinValue: 1000, source: "card-image-ocr", confidence: "high" },
  { cardNo: "031", cardName: "ANCIENT SPIRIT", coinValue: 28, source: "card-image-ocr", confidence: "medium" },
  { cardNo: "039", cardName: "ARMORED SPIRIT", coinValue: 24, source: "card-image-ocr", confidence: "medium" },
  { cardNo: "042", cardName: "LAND OF PROMISE", coinValue: 46, source: "card-image-ocr", confidence: "medium" },
  { cardNo: "045", cardName: "ROOT OF MEMORIES", coinValue: 41, source: "card-image-ocr", confidence: "medium" },
  { cardNo: "050", cardName: "SILENT SANDSTONE", coinValue: 35, source: "card-image-ocr", confidence: "medium" },
  { cardNo: "053", cardName: "STONE KNIGHT", coinValue: 500, source: "card-image-ocr", confidence: "medium" },
  { cardNo: "054", cardName: "MUD EMPEROR", coinValue: 500, source: "card-image-ocr", confidence: "medium" },
  { cardNo: "056", cardName: "STONE TURTLE", coinValue: 56, source: "card-image-ocr", confidence: "medium" },
  { cardNo: "060", cardName: "GOLDEN DEMON", coinValue: 14, source: "card-image-ocr", confidence: "medium" },
  { cardNo: "064", cardName: "GOLDEN CRAB", coinValue: 1, source: "card-image-ocr", confidence: "medium" },
  { cardNo: "065", cardName: "SILVERLIGHT HAWK", coinValue: 1, source: "card-image-ocr", confidence: "medium" },
  { cardNo: "070", cardName: "GOLDEN KNIGHT", coinValue: 64, source: "card-image-ocr", confidence: "medium" },
  { cardNo: "074", cardName: "ARCANE MACHINE", coinValue: 63, source: "card-image-ocr", confidence: "medium" },
  { cardNo: "078", cardName: "THE IRON HAND", coinValue: 97, source: "card-image-ocr", confidence: "medium" },
  { cardNo: "079", cardName: "COLD HUNTER", coinValue: 60, source: "card-image-ocr", confidence: "medium" },
  { cardNo: "080", cardName: "CURSED ARMOR", coinValue: 100, source: "card-image-ocr", confidence: "medium" },
  { cardNo: "085", cardName: "COLDSHADE", coinValue: 550, source: "card-image-ocr", confidence: "medium" },
  { cardNo: "088", cardName: "MAGIC FORCE", coinValue: 88, source: "card-image-ocr", confidence: "medium" },
  { cardNo: "089", cardName: "RUST SPIRIT", coinValue: 59, source: "card-image-ocr", confidence: "medium" },
  { cardNo: "090", cardName: "EMPEROR OF COLD", coinValue: 550, source: "card-image-ocr", confidence: "medium" },
  { cardNo: "094", cardName: "SILVER PHOENIX", coinValue: 98, source: "card-image-ocr", confidence: "medium" },
  { cardNo: "095", cardName: "ANCIENT MECH", coinValue: 99, source: "card-image-ocr", confidence: "medium" },
  { cardNo: "097", cardName: "GOLDEN SAGE", coinValue: 700, source: "card-image-ocr", confidence: "medium" },
  { cardNo: "113", cardName: "WHIRLPOOL MASTER", coinValue: 30, source: "card-image-ocr", confidence: "medium" },
  { cardNo: "116", cardName: "AQUAMANCER", coinValue: 25, source: "card-image-ocr", confidence: "medium" },
  { cardNo: "119", cardName: "NYMPH OF TEARS", coinValue: 89, source: "card-image-ocr", confidence: "medium" },
  { cardNo: "122", cardName: "KEEPER OF TEARS", coinValue: 44, source: "card-image-ocr", confidence: "medium" },
  { cardNo: "123", cardName: "MIST HUNTER", coinValue: 45, source: "card-image-ocr", confidence: "medium" },
  { cardNo: "129", cardName: "ICE PHOENIX", coinValue: 79, source: "card-image-ocr", confidence: "medium" },
  { cardNo: "131", cardName: "WAVE KNIGHT", coinValue: 80, source: "card-image-ocr", confidence: "medium" },
  { cardNo: "132", cardName: "TIDE KING", coinValue: 500, source: "card-image-ocr", confidence: "medium" },
  { cardNo: "133", cardName: "ABYSS LEVIATHAN", coinValue: 36, source: "card-image-ocr", confidence: "medium" },
  { cardNo: "137", cardName: "ABYSS WAIL", coinValue: 87, source: "card-image-ocr", confidence: "medium" },
  { cardNo: "160", cardName: "FLAME GODDESS", coinValue: 51, source: "card-image-ocr", confidence: "medium" },
  { cardNo: "162", cardName: "FLAME SENTINEL", coinValue: 50, source: "card-image-ocr", confidence: "medium" },
  { cardNo: "169", cardName: "EMPEROR OF FIRE", coinValue: 75, source: "card-image-ocr", confidence: "medium" },
  { cardNo: "170", cardName: "HOLY FLAME KNIGHT", coinValue: 800, source: "card-image-ocr", confidence: "medium" },
  { cardNo: "173", cardName: "SOLAR DEMON", coinValue: 91, source: "card-image-ocr", confidence: "medium" },
  { cardNo: "174", cardName: "INFERNO ZERST", coinValue: 68, source: "card-image-ocr", confidence: "medium" },
  { cardNo: "176", cardName: "WAR3RINGER", coinValue: 96, source: "card-image-ocr", confidence: "medium" },
  { cardNo: "202", cardName: "MIND-BINDING VINE", coinValue: 55, source: "card-image-ocr", confidence: "medium" },
  { cardNo: "205", cardName: "SERENE SAMURAI", coinValue: 95, source: "card-image-ocr", confidence: "medium" },
  { cardNo: "208", cardName: "SPRING PHOENIX", coinValue: 500, source: "card-image-ocr", confidence: "medium" },
  { cardNo: "209", cardName: "VINE KNIGHT", coinValue: 500, source: "card-image-ocr", confidence: "medium" },
  { cardNo: "212", cardName: "WILDLORD", coinValue: 65, source: "card-image-ocr", confidence: "medium" },
  { cardNo: "213", cardName: "ELDERBARK", coinValue: 81, source: "card-image-ocr", confidence: "medium" },
  { cardNo: "214", cardName: "SYLVAN GOD", coinValue: 90, source: "card-image-ocr", confidence: "medium" },
  { cardNo: "218", cardName: "CRIP ARMOR", coinValue: 23, source: "card-image-ocr", confidence: "medium" },
  { cardNo: "233", cardName: "GOLDEN ARMOR", coinValue: 20, source: "card-image-ocr", confidence: "medium" },
  { cardNo: "241", cardName: "MECHANISM FUSION", coinValue: 7, source: "card-image-ocr", confidence: "medium" },
  { cardNo: "246", cardName: "ARMOR BREAK", coinValue: 9, source: "card-image-ocr", confidence: "medium" },
  { cardNo: "249", cardName: "VEIL OF MIST", coinValue: 19, source: "card-image-ocr", confidence: "medium" },
  { cardNo: "258", cardName: "WHIRLPOOL SEAL", coinValue: 3, source: "card-image-ocr", confidence: "medium" },
  { cardNo: "261", cardName: "ERODING RIVER", coinValue: 10, source: "card-image-ocr", confidence: "medium" },
  { cardNo: "289", cardName: "CURSED SEED", coinValue: 4, source: "card-image-ocr", confidence: "medium" },
  { cardNo: "291", cardName: "ANCIENT SEAL", coinValue: 5, source: "card-image-ocr", confidence: "medium" },
  { cardNo: "293", cardName: "THE ROOT OF LIFE", coinValue: 8, source: "card-image-ocr", confidence: "medium" },
];

export const nexoraSingleCardNexRewards: NexoraSingleCardNexReward[] =
  cardRareRewards.map((reward) => ({
    cardNo: reward.cardNo,
    cardName: reward.cardName,
    nexValue: Math.max(...reward.options.map((option) => option.nexValue)),
    sourceUrl: NEXORA_SINGLE_CARD_REWARD_SOURCE_URL,
  }));

export const nexoraCoinRewardByCardNo = new Map(
  nexoraCoinRewards.map((reward) => [reward.cardNo, reward])
);

export const nexoraSingleCardNexRewardByCardNo = new Map(
  nexoraSingleCardNexRewards.map((reward) => [reward.cardNo, reward])
);

export function normalizeNexoraCardNo(value: string) {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  const number = Number(digits.slice(-3));
  if (!Number.isFinite(number) || number < 1 || number > 316) return "";
  return String(number).padStart(3, "0");
}

export function getNexoraCoinReward(cardNo: string) {
  const normalized = normalizeNexoraCardNo(cardNo);
  return normalized ? nexoraCoinRewardByCardNo.get(normalized) || null : null;
}

export function getNexoraSingleCardNexReward(cardNo: string) {
  const normalized = normalizeNexoraCardNo(cardNo);
  return normalized ? nexoraSingleCardNexRewardByCardNo.get(normalized) || null : null;
}
import { cardRareRewards } from "@/lib/card-rare-rewards";
