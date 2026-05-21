export type MarketCardFinish = "normal" | "foil";

// Source: D:/NEXORA Official/cards_1-293_master.xlsx, sheet Master.
// Column B non-zero cards can be sold as normal or new foil.
const selectableFoilCardNos = new Set([
  "001", "002", "004", "005", "021", "022", "023", "024", "025", "026", "027", "028",
  "029", "030", "031", "032", "033", "034", "035", "036", "037", "038", "039", "040",
  "041", "042", "043", "044", "045", "046", "047", "048", "049", "050", "051", "052",
  "055", "056", "057", "058", "059", "060", "062", "063", "064", "065", "066", "067",
  "068", "069", "080", "081", "082", "083", "084", "086", "087", "089", "092", "093",
  "094", "095", "096", "098", "100", "101", "102", "103", "104", "105", "106", "107",
  "108", "109", "110", "112", "113", "114", "115", "116", "117", "118", "119", "120",
  "121", "122", "123", "124", "125", "126", "127", "128", "129", "130", "131", "133",
  "134", "135", "136", "137", "138", "139", "140", "141", "142", "143", "144", "145",
  "146", "147", "148", "149", "150", "151", "152", "153", "154", "155", "156", "157",
  "158", "159", "160", "161", "162", "163", "164", "165", "166", "167", "168", "169",
  "171", "173", "174", "175", "176", "177", "178", "180", "181", "182", "183", "184",
  "185", "186", "187", "188", "190", "191", "192", "193", "194", "195", "196", "197",
  "198", "200", "201", "202", "203", "204", "205", "207", "210", "211", "212", "213",
  "214", "215", "216", "217", "218", "219", "220", "221", "222", "223", "224", "225",
  "226", "227", "228", "229", "230", "231", "232", "233", "234", "236", "237", "238",
  "239", "240", "241", "242", "243", "244", "245", "248", "249", "250", "251", "252",
  "253", "255", "256", "257", "258", "259", "260", "261", "262", "263", "264", "265",
  "266", "267", "268", "269", "270", "271", "272", "273", "274", "275", "276", "277",
  "278", "279", "280", "281", "282", "283", "284", "285", "286", "287", "288", "289",
  "290", "291", "292", "293",
]);

// Column C green, non-zero cards are old forced-foil cards only.
const forcedFoilCardNos = new Set([
  "003", "006", "007", "008", "009", "010", "011", "012", "013", "014", "015", "016",
  "017", "018", "019", "020", "053", "054", "061", "070", "071", "072", "073", "074",
  "075", "076", "077", "078", "079", "085", "088", "090", "091", "097", "099", "111",
  "132", "170", "172", "179", "189", "199", "206", "208", "209", "235", "246", "247",
  "254",
]);

export function normalizeCardFinishNo(value: unknown) {
  const digits = String(value || "").replace(/\D/g, "");
  return digits ? digits.padStart(3, "0").slice(-3) : "";
}

export function canChooseCardFinish(cardNo: unknown) {
  return selectableFoilCardNos.has(normalizeCardFinishNo(cardNo));
}

export function isForcedFoilCard(cardNo: unknown) {
  return forcedFoilCardNos.has(normalizeCardFinishNo(cardNo));
}

export function normalizeMarketCardFinish(cardNo: unknown, value: unknown): MarketCardFinish {
  if (isForcedFoilCard(cardNo)) return "foil";
  if (canChooseCardFinish(cardNo)) return value === "foil" ? "foil" : "normal";
  return "normal";
}

export function listingIsFoil(cardNo: unknown, rarity: unknown) {
  return /\bfoil\b|\u0e1f\u0e2d\u0e22\u0e25\u0e4c/i.test(String(rarity || "")) || isForcedFoilCard(cardNo);
}

export function decorateRarityWithFinish(cardNo: unknown, rarity: unknown, finish: MarketCardFinish) {
  const cleanRarity = String(rarity || "")
    .replace(/\s*(?:\u2022|-)?\s*(?:Foil|\u0e1f\u0e2d\u0e22\u0e25\u0e4c)\s*/gi, "")
    .trim();
  const base = cleanRarity || "Unknown";
  return finish === "foil" || isForcedFoilCard(cardNo) ? `Foil \u2022 ${base}` : base;
}
