import { triadCardByNo } from "./triad-dominion";
import type { PentadRoom, PentadChoice } from "./pentad-room-store";
import type { TargetOptionView } from "./target-selection-view";

export function pentadTargetView(room: PentadRoom, choice: PentadChoice) {
  const sequence = choice.options.some(id => id.includes(">"));
  const ids = [...new Set(choice.options.flatMap(id => id.split(">")))];
  const options = ids.flatMap<TargetOptionView>(id => {
    if (id.startsWith("skill:")) {
      const [, lane, no] = id.split(":");
      const card = triadCardByNo.get(no);
      return card ? [{ id, faction: "enemy" as const, label: card.name, card, note: `สกิลตา ${Number(lane) + 1}` }] : [];
    }
    if (["draw-skill", "reroll-own", "reroll-opponent"].includes(id)) return [{ id, faction: id === "reroll-opponent" ? "enemy" as const : "ally" as const, label: id === "draw-skill" ? "สุ่มสกิลเพิ่ม" : id === "reroll-own" ? "เปลี่ยนมอนสเตอร์เรา" : "เปลี่ยนมอนสเตอร์คู่ต่อสู้", action: true }];
    if (id !== "player-top" && id !== "bot-top") return [];
    const targetSide = id === "player-top" ? "host" : "challenger";
    const card = triadCardByNo.get(room.board[targetSide][0]);
    return card ? [{ id, faction: targetSide === choice.side ? "ally" as const : "enemy" as const, label: room.seats[targetSide]?.name || card.name, card }] : [];
  });
  return { options, count: sequence ? 2 : 1, sequences: sequence ? choice.options.map(id => id.split(">")) : undefined };
}
