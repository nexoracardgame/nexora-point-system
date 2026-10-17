function fitBounds(bounds, work) {
 const width=Math.min(bounds.width,work.width),height=Math.min(bounds.height,work.height);
 return {width,height,x:Math.max(work.x,Math.min(bounds.x,work.x+work.width-width)),y:Math.max(work.y,Math.min(bounds.y,work.y+work.height-height))};
}
function manageGameWindow(win,screen) {
 let saved={bounds:win.getNormalBounds(),maximized:win.isMaximized()},transition=false;
 const remember=()=>{if(!transition&&!win.isDestroyed()&&!win.isFullScreen()&&!win.isMinimized())saved={bounds:win.getNormalBounds(),maximized:win.isMaximized()}};
 for(const event of ['move','resize','maximize','unmaximize'])win.on(event,remember);
 const restore=()=>{
  if(win.isDestroyed())return;
  transition=true;win.setResizable(true);
  if(win.isMaximized())win.unmaximize();
  const work=screen.getDisplayMatching(saved.bounds).workArea;
  win.setBounds(fitBounds(saved.bounds,work));
  if(saved.maximized)win.maximize();
  transition=false;
 };
 win.on('leave-full-screen',restore);
 return {setMode(mode){
  if(mode==='fullscreen'){
   if(!win.isFullScreen()){remember();transition=true;win.setFullScreen(true)}
   win.setResizable(false);
  }else{
   transition=true;win.setResizable(true);
   if(win.isFullScreen())win.setFullScreen(false);else restore();
  }
  return true;
 }};
}
module.exports={fitBounds,manageGameWindow};
