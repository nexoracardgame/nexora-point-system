"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Clock3, LogOut, Trophy } from "lucide-react";
import { playGameUiSound } from "@/lib/game-ui-audio";
import "./BattleMatchResult.css";

export default function BattleMatchResult({ title, score, detail, draw = false, onExit, children }: {
  title: string; score?: [number, number]; detail?: string; draw?: boolean; onExit: () => unknown | Promise<unknown>; children?: ReactNode;
}) {
  const exit = useRef(onExit); exit.current = onExit;
  const deadline = useRef(Date.now() + 30_000);
  const leaving = useRef(false);
  const autoAttempted = useRef(false);
  const [seconds, setSeconds] = useState(30);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const leave = async () => {
    if (leaving.current) return;
    leaving.current = true; setBusy(true); setError(false);
    try { if (await exit.current() === false) throw new Error("exit_failed"); }
    catch { leaving.current = false; setBusy(false); setError(true); }
  };
  const leaveRef = useRef(leave); leaveRef.current = leave;
  useEffect(() => {
    playGameUiSound("confirm");
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((deadline.current - Date.now()) / 1000));
      setSeconds(remaining);
      if (remaining === 0 && !autoAttempted.current) { autoAttempted.current = true; void leaveRef.current(); }
    };
    const timer = setInterval(tick, 200);
    return () => clearInterval(timer);
  }, []);
  if (typeof document === "undefined") return null;
  return createPortal(<div className="nexora-result-plane"><section className="nexora-result-window" role="dialog" aria-modal="true" aria-label="ผลการแข่งขัน" data-draw={draw}>
    <div className="nexora-result-rays" aria-hidden="true" />
    <img className="nexora-result-ornament" src="/images/target-ui/header.png" alt="" />
    <div className="nexora-result-emblem"><Trophy aria-hidden="true" /></div>
    <p className="nexora-result-season">NEXORA · BATTLE COMPLETE</p>
    <h2>{draw ? "เสมออย่างสมศักดิ์ศรี" : title}</h2>
    {draw && <p className="nexora-result-detail">{title}</p>}
    {score && <div className="nexora-result-score"><strong>{score[0]}</strong><span>:</span><strong>{score[1]}</strong></div>}
    {detail && <p className="nexora-result-detail">{detail}</p>}
    {children}
    <button autoFocus className="nexora-result-exit" onClick={() => { playGameUiSound("back"); void leave(); }} disabled={busy}><LogOut size={20} />{busy ? "กำลังกลับหน้าหลัก" : "กลับหน้าหลัก"}</button>
    {error && <p role="alert">เชื่อมต่อไม่สำเร็จ กรุณาลองอีกครั้ง</p>}
    <p className="nexora-result-countdown"><Clock3 size={16} />กลับหน้าหลักอัตโนมัติใน <b>{seconds}</b> วินาที</p>
    <div className="nexora-result-timer" role="progressbar" aria-label="เวลาก่อนกลับหน้าหลัก" aria-valuemin={0} aria-valuemax={30} aria-valuenow={seconds}><span style={{ transform: `scaleX(${seconds / 30})` }} /></div>
  </section></div>, document.body);
}
