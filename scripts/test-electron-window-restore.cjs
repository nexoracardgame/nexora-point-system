const {app,BrowserWindow,screen}=require('electron');
const assert=require('node:assert/strict');
const {manageGameWindow,fitBounds}=require('../desktop/game-window-state.cjs');
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
app.whenReady().then(async()=>{
 const win=new BrowserWindow({width:1000,height:650,frame:false,show:false,webPreferences:{nodeIntegration:false,contextIsolation:true}});
 const manager=manageGameWindow(win,screen);
 try{
  await win.loadURL('data:text/html,<body style="background:%23090d14;color:white;font-family:Arial">NEXORA window geometry test</body>');
  win.showInactive();await delay(250);
  for(const bounds of [{x:160,y:120,width:1000,height:650},{x:220,y:150,width:1100,height:700}]){
   const target=fitBounds(bounds,screen.getDisplayMatching(bounds).workArea);
   win.setBounds(target);await delay(200);
   for(let i=0;i<3;i++){
    await manager.setMode('fullscreen');await delay(400);assert.equal(win.isFullScreen(),true);
    await manager.setMode('windowed');await delay(300);
    assert.equal(win.isFullScreen(),false);assert.deepEqual(win.getBounds(),target);
    console.log('REAL ELECTRON restored',JSON.stringify(target),'cycle',i+1);
   }
  }
 }finally{win.destroy();app.quit()}
}).catch(e=>{console.error(e);app.exit(1)});
