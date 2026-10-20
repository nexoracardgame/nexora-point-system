import {homeWallpaperSources,loadHomeWallpaper} from './home-wallpaper';

let video:HTMLVideoElement|undefined,dock:HTMLDivElement|undefined,users=0;
let pauseTimer:ReturnType<typeof setTimeout>|undefined;
function move(parent:HTMLElement,element:HTMLVideoElement){
 const stable=parent as HTMLElement&{moveBefore?:(node:Node,before:Node|null)=>void};
 if(stable.moveBefore&&element.isConnected&&parent.isConnected)stable.moveBefore(element,null);else parent.appendChild(element);
}
function allowed(){let enabled=true;try{enabled=localStorage.getItem('triad-command-motion-off')!=='1'}catch{}return enabled&&!document.hidden&&!matchMedia('(prefers-reduced-motion: reduce)').matches;}
export function warmPreparationVideo(){
 if(video||typeof document==='undefined')return;
 dock=document.createElement('div');dock.setAttribute('aria-hidden','true');dock.style.cssText='position:fixed;width:2px;height:2px;opacity:0;overflow:hidden;pointer-events:none';document.body.appendChild(dock);
 video=document.createElement('video');video.muted=true;video.loop=true;video.playsInline=true;video.preload='auto';video.dataset.ready='false';dock.appendChild(video);
 const element=video;let frames=0;
 const ready=()=>{frames++;if(frames<6&&element.requestVideoFrameCallback){element.requestVideoFrameCallback(ready);return;}element.dataset.ready='true';if(!users)element.pause();};
 element.addEventListener('loadeddata',()=>{if(element.requestVideoFrameCallback)element.requestVideoFrameCallback(ready);else element.dataset.ready='true';});
 element.addEventListener('error',()=>{const sources=homeWallpaperSources('preparation'),next=sources[sources.indexOf(element.getAttribute('src')||'')+1];if(next){frames=0;element.dataset.ready='false';element.src=next;if(allowed())void element.play().catch(()=>{});}});
 void loadHomeWallpaper('preparation').then(source=>{element.src=source;if(allowed())void element.play().catch(()=>{});}).catch(()=>{});
}
export function attachPreparationVideo(parent:HTMLElement){
 warmPreparationVideo();const element=video!;users++;clearTimeout(pauseTimer);move(parent,element);
 const sync=()=>{if(allowed())void element.play().catch(()=>{});else element.pause();};
 const motion=matchMedia('(prefers-reduced-motion: reduce)');motion.addEventListener('change',sync);window.addEventListener('nexora:motion-preference',sync);document.addEventListener('visibilitychange',sync);sync();
 return()=>{users--;motion.removeEventListener('change',sync);window.removeEventListener('nexora:motion-preference',sync);document.removeEventListener('visibilitychange',sync);if(element.parentElement===parent&&dock)move(dock,element);pauseTimer=setTimeout(()=>{if(!users)element.pause();},250);};
}
