export type CollectionRarityKey =
  | "diamond"
  | "gold"
  | "silver"
  | "bronze"
  | "tank";

export type CollectionCardGroup = {
  type: CollectionRarityKey;
  label: string;
  cardIds: number[];
};

export type NexoraCollectionSet = {
  id: string;
  order: number;
  name: string;
  subtitle: string;
  reward: string;
  tier: string;
  stars: string;
  officialTotal: number;
  story: string;
  groups: CollectionCardGroup[];
};

export const NEXORA_COLLECTION_SOURCE_URL =
  "https://www.nexoracardgame.com/card-collections";

const seq = (start: number, end: number) =>
  Array.from({ length: end - start + 1 }, (_, index) => start + index);

const group = (
  type: CollectionRarityKey,
  label: string,
  cardIds: number[]
): CollectionCardGroup => ({
  type,
  label,
  cardIds,
});

export const rarityStyles: Record<
  CollectionRarityKey,
  { label: string; shortLabel: string; className: string }
> = {
  diamond: {
    label: "การ์ดเพชร",
    shortLabel: "เพชร",
    className: "bg-cyan-50 text-cyan-700 ring-cyan-200",
  },
  gold: {
    label: "การ์ดทอง",
    shortLabel: "ทอง",
    className: "bg-[#fff4c2] text-[#8a5a00] ring-[#f2d46d]",
  },
  silver: {
    label: "การ์ดเงิน",
    shortLabel: "เงิน",
    className: "bg-zinc-100 text-zinc-700 ring-zinc-300",
  },
  bronze: {
    label: "การ์ดธรรมดา",
    shortLabel: "ธรรมดา",
    className: "bg-[#f5ede4] text-[#8a4f2b] ring-[#e3c3a6]",
  },
  tank: {
    label: "การ์ดถัง",
    shortLabel: "ถัง",
    className: "bg-stone-100 text-stone-700 ring-stone-300",
  },
};

export const nexoraCollectionSets: NexoraCollectionSet[] = [
  {
    id: "five-concordants",
    order: 1,
    name: "The Five Concordants",
    subtitle: "ผู้พิทักษ์สูงสุดแห่งธาตุทั้งห้า",
    reward: "รับแลกเปลี่ยนเป็นการ์ดซิลเวอร์ จำนวน 1,500,000 ใบ",
    tier: "Mythic",
    stars: "5 ดาว",
    officialTotal: 15,
    story:
      "ห้าอาณาจักรแห่งดิน น้ำ ไฟ ไม้ และทองร่วมสร้าง Concord Seal เพื่อรักษาดุลยภาพของ Sigil",
    groups: [
      group("diamond", "การ์ดเพชร 5 แบบ", [6, 7, 8, 9, 10]),
      group("gold", "การ์ดทอง 10 แบบ", [
        53, 54, 85, 90, 91, 97, 132, 170, 208, 209,
      ]),
    ],
  },
  {
    id: "apex-five",
    order: 2,
    name: "Apex Five",
    subtitle: "จุดสูงสุดของตำนานทั้งห้าธาตุ",
    reward: "รับแลกเปลี่ยนเป็นการ์ดซิลเวอร์ จำนวน 1,000,000 ใบ",
    tier: "Mythic",
    stars: "5 ดาว",
    officialTotal: 5,
    story:
      "เมื่อผู้ครองพลังสูงสุดทั้งห้าปลดปล่อยพลังพร้อมกัน จะเกิดวงแหวนเวทระดับหายนะกลางฟ้า",
    groups: [group("diamond", "การ์ดเพชร 5 แบบ", [6, 7, 8, 9, 10])],
  },
  {
    id: "grand-convergence",
    order: 3,
    name: "Grand Convergence",
    subtitle: "มหาสงครามแห่งการหลอมรวม",
    reward: "รับแลกเปลี่ยนเป็นการ์ดซิลเวอร์ จำนวน 900,000 ใบ",
    tier: "Legendary",
    stars: "4 ดาว",
    officialTotal: 224,
    story:
      "พลังจากทุกธาตุและตำนานทั่วจักรวาล NEXORA หลอมรวมจนกำแพงระหว่างเทพ มนุษย์ และอสูรถูกทำลาย",
    groups: [
      group("gold", "การ์ดทอง 5 แบบ", [91, 132, 170, 174, 209]),
      group("silver", "การ์ดเงิน 99 แบบ", [
        31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 42, 43, 44, 45, 46, 47,
        48, 49, 50, 58, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 81, 82,
        83, 86, 87, 88, 89, 92, 93, 98, 109, 110, 111, 112, 113, 114,
        115, 116, 117, 118, 120, 121, 122, 123, 124, 125, 127, 128, 134,
        148, 149, 150, 151, 152, 153, 154, 155, 156, 157, 158, 159, 161,
        162, 163, 164, 165, 166, 167, 187, 188, 189, 190, 191, 192, 193,
        194, 195, 196, 197, 198, 199, 200, 201, 202, 203, 204, 206, 215,
      ]),
      group("bronze", "การ์ดธรรมดา 120 แบบ", [
        ...seq(21, 30),
        ...seq(60, 69),
        ...seq(99, 108),
        ...seq(138, 147),
        ...seq(177, 186),
        ...seq(216, 293),
      ]),
    ],
  },
  {
    id: "concord-seal-knights",
    order: 4,
    name: "Concord Seal Knights",
    subtitle: "อัศวินที่ตื่นก่อนสงครามธาตุ",
    reward: "รับแลกเปลี่ยนเป็นการ์ดซิลเวอร์ จำนวน 400,000 ใบ",
    tier: "Legendary",
    stars: "4 ดาว",
    officialTotal: 9,
    story:
      "เมื่อโลกเริ่มสั่นไหว ตราแห่งธาตุทั้งห้ากลับมามีพลังและเหล่าอัศวินผู้ถูกผนึกตื่นขึ้น",
    groups: [group("gold", "การ์ดทอง 9 แบบ", [53, 54, 70, 85, 90, 97, 132, 208, 209])],
  },
  {
    id: "free-wardens",
    order: 5,
    name: "Free Wardens",
    subtitle: "ผู้พิทักษ์อิสระแห่งสมดุล",
    reward: "รับแลกเปลี่ยนเป็นการ์ดซิลเวอร์ จำนวน 200,000 ใบ",
    tier: "Legendary",
    stars: "4 ดาว",
    officialTotal: 15,
    story:
      "สิ่งมีชีวิตที่เกิดจากเศษพลังบริสุทธิ์และเจตจำนงของธาตุ ไม่ต้องพึ่งผลึกอีกต่อไป",
    groups: [
      group("tank", "การ์ดถัง 10 แบบ", seq(11, 20)),
      group("gold", "การ์ดทอง 5 แบบ", [1, 2, 3, 4, 5]),
    ],
  },
  {
    id: "warden-core",
    order: 6,
    name: "Warden Core",
    subtitle: "แกนผู้พิทักษ์ชุดถัง",
    reward: "รับแลกเปลี่ยนเป็นการ์ดซิลเวอร์ จำนวน 100,000 ใบ",
    tier: "Legendary",
    stars: "4 ดาว",
    officialTotal: 10,
    story: "ชุดแกนหลักของการ์ดถังที่ใช้ตามล่าความครบถ้วนของสาย Warden",
    groups: [group("tank", "การ์ดถัง 10 แบบ", seq(11, 20))],
  },
  {
    id: "golden-origin-five",
    order: 7,
    name: "Golden Origin Five",
    subtitle: "ผู้พิทักษ์ทองคำต้นกำเนิด",
    reward: "รับแลกเปลี่ยนเป็นการ์ดซิลเวอร์ จำนวน 50,000 ใบ",
    tier: "Legendary",
    stars: "4 ดาว",
    officialTotal: 5,
    story: "ชุดการ์ดทองหมายเลข 1-5 สำหรับผู้เล่นที่ต้องการปิดชุดทองต้นกำเนิดให้ครบ",
    groups: [group("gold", "การ์ดทอง 5 แบบ", [1, 2, 3, 4, 5])],
  },
  {
    id: "elemental-kings",
    order: 8,
    name: "ราชันย์ธาตุ",
    subtitle: "เทพ มังกร และอสูรผู้ครองธาตุ",
    reward: "รับแลกเปลี่ยนเป็นการ์ดซิลเวอร์ จำนวน 100,000 ใบ",
    tier: "Legendary",
    stars: "4 ดาว",
    officialTotal: 20,
    story:
      "เหล่าราชันย์กลับคืนในยุคที่สมดุลธาตุถูกสั่นคลอน และการปรากฏของพวกเขาคือสัญญาณยุคใหม่",
    groups: [
      group("gold", "การ์ดทอง 20 แบบ", [
        41, 52, 56, 57, 59, 119, 129, 133, 136, 168, 169, 171, 172, 173,
        174, 176, 207, 211, 212, 213,
      ]),
    ],
  },
  {
    id: "primordial-spirits",
    order: 9,
    name: "ปฐมอสูรและวิญญาณแห่งธาตุ",
    subtitle: "สิ่งมีชีวิตแรกจากเจตจำนงธรรมชาติ",
    reward: "รับแลกเปลี่ยนเป็นการ์ดซิลเวอร์ จำนวน 100,000 ใบ",
    tier: "Legendary",
    stars: "4 ดาว",
    officialTotal: 30,
    story:
      "ก่อนธาตุจะมีชื่อเรียก ธรรมชาติเริ่มตื่นและสร้างสิ่งมีชีวิตแรกเพื่อสถาปนาโลก",
    groups: [
      group("gold", "การ์ดทอง 10 แบบ", [51, 55, 91, 130, 131, 135, 137, 205, 210, 214]),
      group("silver", "การ์ดเงิน 20 แบบ", [
        42, 43, 44, 45, 46, 47, 48, 49, 50, 58, 75, 120, 121, 122, 123,
        124, 125, 127, 128, 215,
      ]),
    ],
  },
  {
    id: "machine-souls",
    order: 10,
    name: "จิตวิญญาณเครื่องกล",
    subtitle: "โลหะและจักรกลที่ตื่นรู้",
    reward: "รับแลกเปลี่ยนเป็นการ์ดซิลเวอร์ จำนวน 100,000 ใบ",
    tier: "Legendary",
    stars: "4 ดาว",
    officialTotal: 30,
    story:
      "เผ่าพันธุ์แรกพยายามสร้างสิ่งเหนือกว่าเทพ แต่กลับปลุกจิตวิญญาณเครื่องกลให้ตื่นขึ้น",
    groups: [
      group("gold", "การ์ดทอง 10 แบบ", [5, 80, 84, 94, 95, 96, 119, 126, 160, 172]),
      group("silver", "การ์ดเงิน 10 แบบ", [81, 82, 83, 86, 87, 88, 89, 92, 93, 98]),
      group("bronze", "การ์ดธรรมดา 10 แบบ", [236, 237, 238, 239, 240, 258, 259, 260, 261, 262]),
    ],
  },
  {
    id: "reborn-world",
    order: 11,
    name: "โลกหลังยุคเพลิง",
    subtitle: "ไฟ น้ำ และเหล็กหลอมโลกใหม่",
    reward: "รับแลกเปลี่ยนเป็นการ์ดซิลเวอร์ จำนวน 70,000 ใบ",
    tier: "Legendary",
    stars: "2 ดาว",
    officialTotal: 40,
    story:
      "หลังยุคแห่งเพลิง สายน้ำชะล้างเถ้าถ่าน กลไกโบราณเริ่มขยับ และโลก NEXORA ถือกำเนิดอีกครั้ง",
    groups: [
      group("bronze", "การ์ดธรรมดา 40 แบบ", [
        21, 22, 241, 242, 243, 244, 245, 246, 247, 263, 264, 265, 266,
        267, 268, 269, 270, 271, 272, 273, 274, 275, 276, 277, 278, 279,
        280, 281, 282, 283, 284, 285, 286, 287, 288, 289, 290, 291, 292,
        293,
      ]),
    ],
  },
  {
    id: "worldborn-beasts",
    order: 12,
    name: "อสูรกำเนิดโลก",
    subtitle: "ชุดแลก NEXORA GOLD ONE",
    reward: "รับแลกเปลี่ยนเป็น NEXORA GOLD ONE",
    tier: "Legendary",
    stars: "2 ดาว",
    officialTotal: 40,
    story:
      "ก่อนเผ่าพันธุ์ผู้มีปัญญาจะลืมตา สิ่งมีชีวิตดิบเถื่อนจากธาตุทั้งห้าต่อสู้เพื่อยืนยันตน",
    groups: [
      group("bronze", "การ์ดธรรมดา 40 แบบ", [
        27, 28, 29, 30, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 104, 105,
        106, 107, 108, 138, 139, 140, 141, 142, 143, 144, 145, 146, 147,
        177, 178, 179, 180, 181, 182, 183, 184, 185, 186, 247,
      ]),
    ],
  },
  {
    id: "living-steel",
    order: 13,
    name: "เกราะเหล็กกล้าตื่นรู้",
    subtitle: "เสียงค้อนและเปลวเพลิงเวท",
    reward: "รับแลกเปลี่ยนเป็นการ์ดซิลเวอร์ จำนวน 100,000 ใบ",
    tier: "Legendary",
    stars: "3 ดาว",
    officialTotal: 10,
    story:
      "เมื่อค้อนสุดท้ายกระทบแท่นหลอม เหล็กกล้าลืมตา ขยับ และตั้งคำถามต่อคำสั่งแรกของผู้สร้าง",
    groups: [group("silver", "การ์ดเงิน 10 แบบ", seq(70, 79))],
  },
  {
    id: "ancient-balance",
    order: 14,
    name: "พลังดั้งเดิมหลังสงคราม",
    subtitle: "เสียงสะท้อนใต้พื้นหินและคลื่นน้ำ",
    reward: "รับแลกเปลี่ยนเป็น PlayStation 1 เครื่อง",
    tier: "Legendary",
    stars: "3 ดาว",
    officialTotal: 50,
    story:
      "หลังสงครามแห่งธาตุ พลังดั้งเดิมที่ยังไม่ดับสูญเตรียมตื่นขึ้นเพื่อก่อสมดุลใหม่",
    groups: [
      group("gold", "การ์ดทอง 1 แบบ", [97]),
      group("silver", "การ์ดเงิน 20 แบบ", [
        134, 158, 159, 161, 162, 163, 164, 165, 166, 167, 175, 197, 198,
        199, 200, 201, 202, 203, 204, 206,
      ]),
      group("bronze", "การ์ดธรรมดา 29 แบบ", [
        216, 217, 218, 219, 220, 221, 222, 223, 224, 225, 226, 227, 228,
        229, 230, 231, 232, 233, 234, 235, 248, 249, 250, 251, 252, 253,
        255, 256, 257,
      ]),
    ],
  },
  {
    id: "five-realms",
    order: 15,
    name: "ห้าอาณาจักรแห่งพลัง",
    subtitle: "ดิน ไฟ น้ำ ไม้ และโลหะ",
    reward: "รับแลกเปลี่ยนเป็นการ์ดซิลเวอร์ จำนวน 15,000 ใบ",
    tier: "Legendary",
    stars: "2 ดาว",
    officialTotal: 20,
    story:
      "ธาตุทั้งห้าเริ่มมีชีวิตและแยกออกเป็นห้าอาณาจักร แต่ละดินแดนครองพลังของตน",
    groups: [
      group("bronze", "การ์ดธรรมดา 20 แบบ", [
        23, 24, 25, 60, 69, 99, 100, 101, 102, 103, 143, 144, 145, 146,
        147, 182, 183, 184, 185, 186,
      ]),
    ],
  },
  {
    id: "ancient-monster-return",
    order: 16,
    name: "อสูรโบราณคืนสนาม",
    subtitle: "แรงสั่นสะเทือนแห่งภูผา ทะเล และเพลิง",
    reward: "รับแลกเปลี่ยนเป็นการ์ดซิลเวอร์ จำนวน 15,000 ใบ",
    tier: "Legendary",
    stars: "2 ดาว",
    officialTotal: 20,
    story:
      "อสูรที่ถูกผนึกในตำนานกลับคืนสู่สนามแห่งชะตาเพื่อช่วงชิงสิทธิ์ในการครองพิภพ",
    groups: [
      group("silver", "การ์ดเงิน 5 แบบ", [45, 89, 163, 164, 215]),
      group("bronze", "การ์ดธรรมดา 15 แบบ", [
        68, 69, 99, 179, 226, 231, 232, 236, 238, 248, 256, 257, 270,
        279, 287,
      ]),
    ],
  },
  {
    id: "forgotten-monsters",
    order: 17,
    name: "อสูรที่ถูกลืม",
    subtitle: "สงครามของสิ่งมีชีวิตที่โลกหลงลืม",
    reward: "รับแลกเปลี่ยนเป็นการ์ดซิลเวอร์ จำนวน 15,000 ใบ",
    tier: "Legendary",
    stars: "2 ดาว",
    officialTotal: 20,
    story:
      "อสูรใต้ทะเลลึกและยอดภูผาตื่นจากการผนึก เพื่อทวงคืนสมดุลที่มนุษย์และเทพทำลายลง",
    groups: [
      group("bronze", "การ์ดธรรมดา 20 แบบ", [
        24, 61, 99, 101, 102, 103, 144, 186, 218, 219, 222, 236, 240, 248,
        249, 250, 268, 269, 277, 288,
      ]),
    ],
  },
  {
    id: "aurelian-gold",
    order: 18,
    name: "อสูรทองคำแห่งออเรียน",
    subtitle: "หัวใจของโลกเก่า",
    reward: "รับแลกเปลี่ยนเป็นการ์ดซิลเวอร์ จำนวน 5,000 ใบ",
    tier: "Legendary",
    stars: "2 ดาว",
    officialTotal: 10,
    story:
      "เศษซากอาณาจักรออเรียนปลุกอสูรทองคำและหัวใจแห่งโลกเก่าให้ลุกขึ้นทวงคืนมรดก",
    groups: [
      group("gold", "การ์ดทอง 1 แบบ", [95]),
      group("silver", "การ์ดเงิน 1 แบบ", [98]),
      group("bronze", "การ์ดธรรมดา 8 แบบ", [60, 61, 62, 63, 64, 285, 289, 290]),
    ],
  },
  {
    id: "quiet-mountain",
    order: 19,
    name: "ภูผาแห่งความสงบ",
    subtitle: "ธรรมชาติและจักรกลที่เริ่มสั่นคลอน",
    reward: "รับแลกเปลี่ยนเป็นการ์ดซิลเวอร์ จำนวน 5,000 ใบ",
    tier: "Legendary",
    stars: "2 ดาว",
    officialTotal: 10,
    story:
      "ภูผา รากไม้ และศิลาโบราณซ่อนปัญญาไว้ เมื่อเวทกลไกและมนตราน้ำรบกวนสมดุล วิญญาณผืนดินจึงตื่นขึ้น",
    groups: [
      group("silver", "การ์ดเงิน 4 แบบ", [44, 45, 46, 47]),
      group("bronze", "การ์ดธรรมดา 6 แบบ", [178, 179, 241, 242, 255, 256]),
    ],
  },
];

export function getCollectionCardIds(set: NexoraCollectionSet) {
  return Array.from(
    new Set(set.groups.flatMap((item) => item.cardIds))
  ).sort((a, b) => a - b);
}
