export async function setGameWindowMode(mode:'windowed'|'fullscreen'){
 const bridge=(window as typeof window&{nexoraDesktop?:{windowControl?:(action:string)=>Promise<boolean>}}).nexoraDesktop;
 const applied=await bridge?.windowControl?.(mode==='fullscreen'?'fullscreen':'windowed');
 if(!applied){if(mode==='fullscreen'&&!document.fullscreenElement)await document.documentElement.requestFullscreen();if(mode==='windowed'&&document.fullscreenElement)await document.exitFullscreen();}
 localStorage.setItem('nexora-window-mode',mode);document.documentElement.dataset.gameWindowMode=mode;window.dispatchEvent(new Event('nexora:window-mode'));
}
