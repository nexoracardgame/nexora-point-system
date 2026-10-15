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

export function confirmBattleLeave() {
  return nexoraConfirm({ title: "ยืนยันออกจากห้อง?", message: "หากยืนยัน จะไม่สามารถกลับเข้าร่วมสนามนี้ได้ และฝ่ายตรงข้ามจะชนะทันที", tone: "danger", confirmText: "ยืนยัน", cancelText: "ยกเลิก" });
}
