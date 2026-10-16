export function gameVolume(kind: 'music' | 'effects') {
  try { const value=localStorage.getItem(`nexora-volume-${kind}`);return value===null?(localStorage.getItem('triad-battle-muted')==='1'?0:1):Math.max(0,Math.min(1,Number(value)||0)); } catch { return 1; }
}
export function saveGameSetting(kind:'music'|'effects'|'motion',value:number|boolean) {
  try { if(kind==='motion')localStorage.setItem('triad-command-motion-off',value?'1':'0');else {localStorage.setItem(`nexora-volume-${kind}`,String(value));localStorage.setItem('triad-battle-muted','0');} } catch {}
  try { document.documentElement.dataset.gameMotionOff=localStorage.getItem('triad-command-motion-off')==='1'?'true':'false'; } catch {}
  window.dispatchEvent(new Event('nexora:audio-preference'));window.dispatchEvent(new Event('nexora:motion-preference'));
}
