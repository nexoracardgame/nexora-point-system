export async function setGameWindowMode(mode:'windowed'|'fullscreen'){
 const bridge=(window as typeof window&{nexoraDesktop?:{windowControl?:(action:string)=>Promise<boolean>}}).nexoraDesktop;
 // Start within the input event: awaiting IPC first can consume user activation.
 const browserChange=mode==='fullscreen'
  ? document.fullscreenElement ? Promise.resolve() : document.documentElement.requestFullscreen?.() ?? Promise.reject(new Error('Fullscreen unavailable'))
  : document.fullscreenElement ? document.exitFullscreen() : Promise.resolve();
 const [browser,native]=await Promise.allSettled([browserChange,bridge?.windowControl?.(mode)]);
 const browserApplied=browser.status==='fulfilled'&&(mode==='windowed'||!!document.fullscreenElement);
 if(!browserApplied&&!(native.status==='fulfilled'&&native.value===true))throw new Error('Window mode change failed');
 try{localStorage.setItem('nexora-window-mode',mode)}catch{}
 document.documentElement.dataset.gameWindowMode=mode;window.dispatchEvent(new Event('nexora:window-mode'));
}
