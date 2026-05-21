export type MarketCardFinish = "normal" | "foil";

const selectableFoilCardNos = new Set([
  "021", "022", "023", "024", "025", "026", "027", "028", "029", "030",
  "060", "062", "063", "064", "065", "067", "068", "069",
  "099", "100", "101", "102", "103", "104", "105", "106", "107", "110", "112", "113", "114", "115",
  "140", "141", "142", "158", "159",
  "177", "178", "179", "180", "181", "182", "183", "184", "185", "186",
  "216", "217", "218", "219", "220", "221", "222", "223", "224", "225", "226", "227", "228", "229",
  "231", "232", "233", "234", "236", "237", "238", "239",
  "241", "242", "243", "244", "245", "246", "247", "248", "249", "250",
  "252", "253", "254", "255", "256", "260", "261", "262", "263", "264", "265", "266", "267", "268",
  "269", "270", "272", "273", "274", "275", "276", "277", "278", "279", "280", "282", "283", "284",
  "285", "286", "287", "288", "290", "291", "292", "293",
]);

const forcedFoilCardNos = new Set([
  "002", "004", "005", "020",
  "031", "032", "033", "034", "035", "036", "037", "038", "039", "040", "041", "042", "043", "044",
  "045", "046", "047", "048", "049", "050", "051", "052", "054", "055", "056", "057", "058", "059",
  "077", "078", "080", "081", "082", "083", "084", "089", "091", "092", "093", "094", "095", "096",
  "097", "098", "115", "116", "117", "118", "119", "120", "121", "122", "123", "124", "125", "126",
  "127", "128", "129", "130", "131", "134", "135", "156", "159", "160", "161", "162", "163", "167",
  "168", "169", "171", "172", "173", "174", "175", "176", "187", "188", "191", "192", "193", "195",
  "196", "197", "198", "199", "200", "201", "202", "203", "204", "205", "206", "207", "208", "211",
  "212", "213", "214", "215",
]);

export function normalizeCardFinishNo(value: unknown) {
  const digits = String(value || "").replace(/\D/g, "");
  return digits ? digits.padStart(3, "0").slice(-3) : "";
}

export function canChooseCardFinish(cardNo: unknown) {
  return selectableFoilCardNos.has(normalizeCardFinishNo(cardNo));
}

export function isForcedFoilCard(cardNo: unknown) {
  const normalized = normalizeCardFinishNo(cardNo);
  return forcedFoilCardNos.has(normalized) && !selectableFoilCardNos.has(normalized);
}

export function normalizeMarketCardFinish(cardNo: unknown, value: unknown): MarketCardFinish {
  if (isForcedFoilCard(cardNo)) return "foil";
  if (canChooseCardFinish(cardNo)) return value === "foil" ? "foil" : "normal";
  return "normal";
}

export function listingIsFoil(cardNo: unknown, rarity: unknown) {
  return /\bfoil\b|ฟอยล์/i.test(String(rarity || "")) || isForcedFoilCard(cardNo);
}

export function decorateRarityWithFinish(cardNo: unknown, rarity: unknown, finish: MarketCardFinish) {
  const cleanRarity = String(rarity || "").replace(/\s*[•-]?\s*(Foil|ฟอยล์)\s*/gi, "").trim();
  const base = cleanRarity || "Unknown";
  return finish === "foil" || isForcedFoilCard(cardNo) ? `Foil • ${base}` : base;
}
