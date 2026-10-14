"use client";

import { createContext, useContext, useLayoutEffect, useMemo, useState, useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { triadCardByNo } from "@/lib/triad-dominion";
import { pentadElementNames } from "@/lib/pentad-dominion";
import styles from "./PentadDominion.module.css";

const PreviewContext = createContext({ show: (_no: string, _modal = false) => {}, hide: (_no: string) => {} });
export const usePentadCardPreview = () => useContext(PreviewContext);

export default function PentadCardPreview({ children, contextKey }: { children: ReactNode; contextKey: string }) {
  const [preview, setPreview] = useState<{ no: string; modal: boolean } | null>(null);
  const [mounted, setMounted] = useState(false);
  useLayoutEffect(() => { setMounted(true); setPreview(null); }, [contextKey]);
  const actions = useMemo(() => ({
    show: (no: string, modal = false) => { if (triadCardByNo.has(no)) setPreview(current => current?.no === no && current.modal === modal ? current : { no, modal }); },
    hide: (no: string) => setPreview(current => current?.no === no && !current.modal ? null : current),
  }), []);
  useEffect(() => {
    if (!preview) return;
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setPreview(null); };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [Boolean(preview)]);
  const card = preview ? triadCardByNo.get(preview.no) : undefined;
  return <PreviewContext.Provider value={actions}>{children}{mounted && card && preview && createPortal(
    <div className={styles.previewPlane} data-interactive={preview.modal} role="dialog" aria-modal={preview.modal} aria-label={`รายละเอียด No.${card.cardNo}`} onClick={event => { if (event.target === event.currentTarget) setPreview(null); }}>
      <section className={styles.previewPanel}>
        {preview.modal && <button className={styles.previewClose} aria-label="ปิดหน้าต่างการ์ด" onClick={() => setPreview(null)}><X size={20} /></button>}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={card.sourceImage} alt={card.name} draggable={false} />
        <div className={styles.previewInfo}><small>No.{card.cardNo} · {card.kind === "skill" ? "สกิล" : "มอนสเตอร์"} · ธาตุ{pentadElementNames[card.element]}</small><h2>{card.name}</h2>
          {card.kind === "monster" && <div className={styles.previewStats}><span>ATK {card.attack.toLocaleString()}</span><span>SUP {card.support.toLocaleString()}</span></div>}
          <p>{card.skillText || "มอนสเตอร์ใช้ค่าพลังและธาตุในการปะทะ"}</p>
        </div>
      </section>
    </div>, document.body
  )}</PreviewContext.Provider>;
}
