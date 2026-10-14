"use client";

import { createContext, useContext, useLayoutEffect, useMemo, useState, useEffect, type ReactNode } from "react";
import { triadCardByNo } from "@/lib/triad-dominion";
import { pentadElementNames } from "@/lib/pentad-dominion";
import BattleCardInspector from "@/components/BattleCardInspector";

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
  return <PreviewContext.Provider value={actions}>{children}{mounted && card && preview && <BattleCardInspector card={card} element={`ธาตุ${pentadElementNames[card.element]}`} interactive={preview.modal} onClose={()=>setPreview(null)} />}</PreviewContext.Provider>;
}
