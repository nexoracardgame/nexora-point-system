function fitBounds(bounds, work) {
 const width=Math.min(bounds.width,work.width),height=Math.min(bounds.height,work.height);
 return {width,height,x:Math.max(work.x,Math.min(bounds.x,work.x+work.width-width)),y:Math.max(work.y,Math.min(bounds.y,work.y+work.height-height))};
}
function manageGameWindow(win,screen) {
 const snapshot=()=>({bounds:win.isMaximized()?win.getNormalBounds():win.getBounds(),maximized:win.isMaximized()});
 let saved=snapshot(),transition=false,restoring=null;
 const remember=()=>{if(!transition&&!win.isDestroyed()&&!win.isFullScreen()&&!win.isMinimized())saved=snapshot()};
 for(const event of ['move','resize','maximize','unmaximize'])win.on(event,remember);
 const restore=()=>{
  if(restoring)return restoring;
  transition=true;
  const target={bounds:{...saved.bounds},maximized:saved.maximized};
  restoring=(async()=>{
   // Windows may send WM_SIZE/WM_MOVE after leave-full-screen; do not save those.
   await new Promise(resolve=>setTimeout(resolve,160));
   if(win.isDestroyed())return false;
   const bounds=fitBounds(target.bounds,screen.getDisplayMatching(target.bounds).workArea);
   win.setResizable(true);
   if(win.isMaximized())win.unmaximize();
   win.setBounds(bounds,false);
   if(target.maximized)win.maximize();
   let stable=0;
   for(let i=0;i<20;i++){
    await new Promise(resolve=>setTimeout(resolve,60));
    if(win.isDestroyed())return false;
    if(win.isFullScreen()){stable=0;continue}
    const actual=win.getBounds();
    const matches=target.maximized?win.isMaximized():!win.isMaximized()&&['x','y','width','height'].every(key=>Math.abs(actual[key]-bounds[key])<=1);
    if(matches){if(++stable>=6)break}else{stable=0;if(win.isMaximized())win.unmaximize();win.setBounds(bounds,false);if(target.maximized)win.maximize()}
   }
   saved={bounds,maximized:target.maximized};
   return true;
  })().finally(()=>{transition=false;restoring=null});
  return restoring;
 };
 win.on('leave-full-screen',()=>{void restore()});
 return {async setMode(mode){
  if(restoring)await restoring;
  if(mode==='fullscreen'){
   if(!win.isFullScreen()){remember();transition=true;win.setFullScreen(true)}
   win.setResizable(false);
  }else{
   transition=true;win.setResizable(true);
   if(win.isFullScreen()){
    await new Promise(resolve=>{const done=()=>{clearTimeout(timer);win.removeListener('leave-full-screen',done);resolve()};const timer=setTimeout(done,1500);win.once('leave-full-screen',done);win.setFullScreen(false)});
   }
   return await restore();
  }
  return true;
 }};
}
module.exports={fitBounds,manageGameWindow};
