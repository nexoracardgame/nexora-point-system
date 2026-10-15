import { nexoraConfirm } from "./nexora-dialog";

export function confirmBattleSurrender() {
  return nexoraConfirm({
    title: "ยืนยันยอมแพ้?",
    message: "การต่อสู้จะจบลงทันที และคู่ต่อสู้จะเป็นผู้ชนะ",
    tone: "danger",
    confirmText: "ยืนยันยอมแพ้",
    cancelText: "สู้ต่อ",
  });
}
