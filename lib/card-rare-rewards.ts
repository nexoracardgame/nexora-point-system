export type CardRareRewardOption = {
  key: string;
  label: string;
  conditionLabel: string | null;
  nexValue: number;
};

export type CardRareReward = {
  cardNo: string;
  cardName: string;
  tier: string;
  imageUrl: string;
  options: CardRareRewardOption[];
};

const SHEET_SOURCE_URL =
  "https://docs.google.com/spreadsheets/d/1zXG8UycndiDuehWQNfqXMvMWrnEoxuqjn_NURWSa7-0/edit?gid=0#gid=0";

function localCardImage(cardNo: string) {
  return `/cards/${cardNo}.jpg`;
}

function standard(nexValue: number, foil = false): CardRareRewardOption {
  return {
    key: "standard",
    label: foil ? "การ์ดฟอยล์แรร์หายากพิเศษ" : "การ์ดแรร์หายากพิเศษ",
    conditionLabel: null,
    nexValue,
  };
}

function serial(nexValue: number): CardRareRewardOption {
  return {
    key: "serial_1_9_18",
    label: "การ์ดฟอยล์แรร์หายากพิเศษลำดับเลข 1, 9, 18",
    conditionLabel: "ลำดับเลข 1, 9 หรือ 18",
    nexValue,
  };
}

export const cardRareRewardSourceUrl = SHEET_SOURCE_URL;

export const cardRareRewards: CardRareReward[] = [
  { cardNo: "001", cardName: "Earth Crystal", tier: "Gold", imageUrl: localCardImage("001"), options: [standard(100, true)] },
  { cardNo: "002", cardName: "Flame Crystal", tier: "Gold", imageUrl: localCardImage("002"), options: [standard(100, true)] },
  { cardNo: "003", cardName: "Golden Crystal", tier: "Gold", imageUrl: localCardImage("003"), options: [standard(15000)] },
  { cardNo: "006", cardName: "Kael Ignivar", tier: "Diamond", imageUrl: localCardImage("006"), options: [standard(200000)] },
  { cardNo: "007", cardName: "Kaera Forgeheart", tier: "Diamond", imageUrl: localCardImage("007"), options: [standard(80000)] },
  { cardNo: "008", cardName: "Lyssara Poseidon", tier: "Diamond", imageUrl: localCardImage("008"), options: [standard(100000)] },
  { cardNo: "018", cardName: "Golden Aegis", tier: "Tank", imageUrl: localCardImage("018"), options: [standard(30000)] },
  { cardNo: "020", cardName: "Ocean Pulse", tier: "Tank", imageUrl: localCardImage("020"), options: [standard(15000)] },
  { cardNo: "031", cardName: "Ancient Spirit", tier: "Silver", imageUrl: localCardImage("031"), options: [standard(100, true)] },
  { cardNo: "032", cardName: "Earth Phantom", tier: "Silver", imageUrl: localCardImage("032"), options: [standard(100, true)] },
  { cardNo: "033", cardName: "Earth Worrior", tier: "Silver", imageUrl: localCardImage("033"), options: [standard(100, true)] },
  { cardNo: "034", cardName: "Earthshaker", tier: "Silver", imageUrl: localCardImage("034"), options: [standard(100, true)] },
  { cardNo: "035", cardName: "Pebble Mage", tier: "Silver", imageUrl: localCardImage("035"), options: [standard(100, true)] },
  { cardNo: "046", cardName: "Tearless Stone", tier: "Silver", imageUrl: localCardImage("046"), options: [standard(200, true)] },
  { cardNo: "048", cardName: "Grit Wall", tier: "Silver", imageUrl: localCardImage("048"), options: [standard(2000, true)] },
  { cardNo: "051", cardName: "Earthdrake", tier: "Gold", imageUrl: localCardImage("051"), options: [standard(100, true)] },
  { cardNo: "052", cardName: "Terranox", tier: "Gold", imageUrl: localCardImage("052"), options: [standard(100, true)] },
  { cardNo: "053", cardName: "Stone Knight", tier: "Gold", imageUrl: localCardImage("053"), options: [standard(1000)] },
  { cardNo: "054", cardName: "Mud Emperor", tier: "Gold", imageUrl: localCardImage("054"), options: [standard(500)] },
  { cardNo: "061", cardName: "Ironfang", tier: "Bronze", imageUrl: localCardImage("061"), options: [standard(3000)] },
  { cardNo: "066", cardName: "Iron Viper", tier: "Bronze", imageUrl: localCardImage("066"), options: [standard(200, true)] },
  { cardNo: "068", cardName: "Digger Mole", tier: "Bronze", imageUrl: localCardImage("068"), options: [standard(2000, true)] },
  { cardNo: "085", cardName: "Goldshade", tier: "Gold", imageUrl: localCardImage("085"), options: [standard(10000)] },
  { cardNo: "088", cardName: "Magic Forge", tier: "Silver", imageUrl: localCardImage("088"), options: [standard(30000)] },
  { cardNo: "089", cardName: "Rust Spirit", tier: "Silver", imageUrl: localCardImage("089"), options: [standard(200, true)] },
  { cardNo: "090", cardName: "Emperor of Gold", tier: "Gold", imageUrl: localCardImage("090"), options: [standard(60000)] },
  { cardNo: "091", cardName: "Crystal Dragon", tier: "Gold", imageUrl: localCardImage("091"), options: [standard(40000)] },
  { cardNo: "097", cardName: "Golden Sage", tier: "Gold", imageUrl: localCardImage("097"), options: [standard(5000)] },
  { cardNo: "099", cardName: "Aqualash", tier: "Bronze", imageUrl: localCardImage("099"), options: [standard(10000)] },
  { cardNo: "108", cardName: "Shadow Seahorse", tier: "Bronze", imageUrl: localCardImage("108"), options: [standard(200, true)] },
  { cardNo: "111", cardName: "Sea Queen", tier: "Silver", imageUrl: localCardImage("111"), options: [standard(25000)] },
  { cardNo: "123", cardName: "Mist Hunter", tier: "Silver", imageUrl: localCardImage("123"), options: [standard(300, true)] },
  { cardNo: "145", cardName: "Blaze Storm", tier: "Bronze", imageUrl: localCardImage("145"), options: [standard(200, true)] },
  { cardNo: "154", cardName: "Lavagor", tier: "Silver", imageUrl: localCardImage("154"), options: [standard(200, true)] },
  { cardNo: "155", cardName: "Fire Reaper", tier: "Silver", imageUrl: localCardImage("155"), options: [standard(200, true)] },
  { cardNo: "158", cardName: "Blaze Warlock", tier: "Silver", imageUrl: localCardImage("158"), options: [standard(300, true)] },
  { cardNo: "164", cardName: "Flame Devourer", tier: "Silver", imageUrl: localCardImage("164"), options: [standard(100, true)] },
  { cardNo: "165", cardName: "Pyrosigil", tier: "Silver", imageUrl: localCardImage("165"), options: [standard(100, true)] },
  { cardNo: "170", cardName: "Holy Flame Knight", tier: "Gold", imageUrl: localCardImage("170"), options: [standard(70000)] },
  { cardNo: "172", cardName: "Azure Phoenix", tier: "Gold", imageUrl: localCardImage("172"), options: [standard(40000)] },
  { cardNo: "189", cardName: "Forest Mage", tier: "Silver", imageUrl: localCardImage("189"), options: [standard(30000)] },
  { cardNo: "191", cardName: "Ancient Shade", tier: "Silver", imageUrl: localCardImage("191"), options: [standard(200, true)] },
  { cardNo: "202", cardName: "Mind-Binding Vine", tier: "Silver", imageUrl: localCardImage("202"), options: [standard(2000, true)] },
  { cardNo: "205", cardName: "Serene Samurai", tier: "Gold", imageUrl: localCardImage("205"), options: [standard(2000, true)] },
  { cardNo: "206", cardName: "Tree of Grace", tier: "Silver", imageUrl: localCardImage("206"), options: [standard(25000)] },
  { cardNo: "213", cardName: "Elderbark", tier: "Gold", imageUrl: localCardImage("213"), options: [standard(300, true)] },
  { cardNo: "222", cardName: "Rockspike", tier: "Bronze", imageUrl: localCardImage("222"), options: [standard(300, true)] },
  { cardNo: "240", cardName: "Reverse Field", tier: "Bronze", imageUrl: localCardImage("240"), options: [standard(200, true)] },
  { cardNo: "246", cardName: "Armor Break", tier: "Bronze", imageUrl: localCardImage("246"), options: [standard(10000)] },
  { cardNo: "247", cardName: "Golden Seal", tier: "Bronze", imageUrl: localCardImage("247"), options: [standard(10000)] },
  { cardNo: "252", cardName: "Cleansing Wave", tier: "Bronze", imageUrl: localCardImage("252"), options: [standard(100, true)] },
  { cardNo: "253", cardName: "Flowing Magic", tier: "Bronze", imageUrl: localCardImage("253"), options: [standard(100, true)] },
  { cardNo: "254", cardName: "Divine Blessing", tier: "Bronze", imageUrl: localCardImage("254"), options: [standard(20000)] },
  { cardNo: "255", cardName: "Hydroburst", tier: "Bronze", imageUrl: localCardImage("255"), options: [standard(100, true)] },
  { cardNo: "256", cardName: "Aqua Barrier", tier: "Bronze", imageUrl: localCardImage("256"), options: [standard(100, true)] },
  { cardNo: "257", cardName: "Still Droplet Trap", tier: "Bronze", imageUrl: localCardImage("257"), options: [standard(100, true)] },
  { cardNo: "258", cardName: "Whirlpool Seal", tier: "Bronze", imageUrl: localCardImage("258"), options: [standard(100, true)] },
  { cardNo: "259", cardName: "Tidebomb", tier: "Bronze", imageUrl: localCardImage("259"), options: [standard(100, true)] },
  { cardNo: "261", cardName: "Eroding River", tier: "Bronze", imageUrl: localCardImage("261"), options: [standard(100, true)] },
  { cardNo: "262", cardName: "Water Armor", tier: "Bronze", imageUrl: localCardImage("262"), options: [standard(100, true)] },
  { cardNo: "266", cardName: "Flarebind", tier: "Bronze", imageUrl: localCardImage("266"), options: [standard(100, true)] },
  { cardNo: "267", cardName: "Breath of Flame", tier: "Bronze", imageUrl: localCardImage("267"), options: [standard(100, true)] },
  { cardNo: "269", cardName: "Pit of Fire", tier: "Bronze", imageUrl: localCardImage("269"), options: [standard(100, true)] },
  { cardNo: "270", cardName: "Ash Explosion", tier: "Bronze", imageUrl: localCardImage("270"), options: [standard(100, true)] },
  { cardNo: "271", cardName: "Reflective Torch", tier: "Bronze", imageUrl: localCardImage("271"), options: [standard(100, true)] },
  { cardNo: "286", cardName: "Hidden Thorns", tier: "Bronze", imageUrl: localCardImage("286"), options: [standard(200, true)] },
  { cardNo: "289", cardName: "Cursed Seed", tier: "Bronze", imageUrl: localCardImage("289"), options: [standard(200, true)] },
  { cardNo: "312", cardName: "Choice of Destiny", tier: "Gold", imageUrl: "https://i.ibb.co/mVTr4CQg/312-copy.jpg", options: [standard(2000, true), serial(5000)] },
  { cardNo: "313", cardName: "Ability Lock", tier: "Gold", imageUrl: "https://i.ibb.co/S7r49MtD/313-copy.jpg", options: [standard(2000, true), serial(5000)] },
  { cardNo: "314", cardName: "Wrathful Wave", tier: "Gold", imageUrl: "https://i.ibb.co/Kj7B9YcT/314-copy.jpg", options: [standard(2000, true), serial(5000)] },
  { cardNo: "315", cardName: "Limit Break", tier: "Gold", imageUrl: "https://i.ibb.co/nTZmcX8/315-copy.jpg", options: [standard(2000, true), serial(5000)] },
  { cardNo: "316", cardName: "Counter Assault", tier: "Gold", imageUrl: "https://i.ibb.co/q3BLsQcS/316-copy.jpg", options: [standard(2000, true), serial(5000)] },
];

export const cardRareRewardByCardNo = new Map(
  cardRareRewards.map((reward) => [reward.cardNo, reward])
);

export function getCardRareRewardByCardNo(cardNo: string) {
  const normalized = String(cardNo || "").replace(/\D/g, "").padStart(3, "0");
  return cardRareRewardByCardNo.get(normalized) || null;
}

export function getCardRareRewardChoice(cardNo: string, optionKey = "standard") {
  const reward = getCardRareRewardByCardNo(cardNo);
  if (!reward) return null;

  const option =
    reward.options.find((item) => item.key === optionKey) || reward.options[0];
  if (!option) return null;

  return {
    reward,
    option,
    rewardLabel: `${option.label} ${reward.cardName} #${reward.cardNo}`,
    conditionLabel: option.conditionLabel,
    nexValue: option.nexValue,
  };
}
