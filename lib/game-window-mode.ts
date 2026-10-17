let changeId=0;
function publishMode(mode:'windowed'|'fullscreen'){
 try{localStorage.setItem('nexora-window-mode',mode)}catch{}
 document.documentElement.dataset.gameWindowMode=mode;window.dispatchEvent(new Event('nexora:window-mode'));
}
export function currentGameWindowMode(){return typeof document!=='undefined'&&(!!document.fullscreenElement||document.documentElement.dataset.gameWindowMode==='fullscreen')?'fullscreen':'windowed';}
if(typeof document!=='undefined')document.addEventListener('fullscreenchange',()=>{publishMode(document.fullscreenElement?'fullscreen':'windowed')});
export async function setGameWindowMode(mode:'windowed'|'fullscreen'){
 const id=++changeId;
 const bridge=(window as typeof window&{nexoraDesktop?:{supportsNativeWindowModes?:boolean;windowControl?:(action:string)=>Promise<boolean>}}).nexoraDesktop;
 if(bridge?.supportsNativeWindowModes&&bridge.windowControl){
  if(document.fullscreenElement)await document.exitFullscreen();
  if(!await bridge.windowControl(mode))throw Error('Native window change failed');
  if(id===changeId)publishMode(mode);
  return;
 }
 // Start within the input event: awaiting IPC first can consume user activation.
 const browserChange=mode==='fullscreen'
  ? document.fullscreenElement ? Promise.resolve() : document.documentElement.requestFullscreen?.() ?? Promise.reject(new Error('Fullscreen unavailable'))
  : document.fullscreenElement ? document.exitFullscreen() : Promise.resolve();
 const browser=browserChange.then(()=>{if(mode==='fullscreen'&&!document.fullscreenElement)throw Error('Fullscreen unavailable');if(mode==='windowed'&&bridge?.windowControl&&document.documentElement.dataset.gameWindowMode==='fullscreen')throw Error('Native window change required');});
 const native=Promise.resolve().then(()=>bridge?.windowControl?.(mode)).then(applied=>{if(applied!==true)throw Error('Native window change unavailable')});
 // A completed browser transition must not wait for an older desktop IPC bridge.
 await Promise.any([browser,native]);
 if(id===changeId)publishMode(mode);
}
