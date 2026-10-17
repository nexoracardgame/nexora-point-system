const {EventEmitter}=require('node:events'),assert=require('node:assert/strict');
const {manageGameWindow}=require('../desktop/game-window-state.cjs');
class Window extends EventEmitter {
 constructor(){super();this.bounds={x:230,y:140,width:1050,height:650};this.normal={...this.bounds};this.max=false;this.full=false}
 getBounds(){return {...this.bounds}}getNormalBounds(){return {...this.normal}}isMaximized(){return this.max}isDestroyed(){return false}isFullScreen(){return this.full}isMinimized(){return false}setResizable(v){this.resizable=v}
 setBounds(v){this.bounds={...v};this.normal={...v};this.emit('move');this.emit('resize')}
 maximize(){this.max=true;this.emit('maximize')}unmaximize(){this.max=false;this.emit('unmaximize')}
 setFullScreen(v){this.full=v;if(v){this.bounds={x:0,y:0,width:1920,height:1080};this.emit('resize')}else{this.bounds={x:-900,y:0,width:1920,height:1080};this.emit('resize');this.emit('leave-full-screen')}}
}
let work={x:0,y:0,width:1920,height:1040};
const win=new Window(),manager=manageGameWindow(win,{getDisplayMatching:()=>({workArea:work})});
(async()=>{
for(let i=0;i<4;i++){const expected=win.getBounds();await manager.setMode('fullscreen');await manager.setMode('fullscreen');const restoring=manager.setMode('windowed');setTimeout(()=>{win.setBounds({x:200,y:100,width:1920,height:1080})},240);await restoring;assert.deepEqual(win.bounds,expected);assert.equal(win.resizable,true);win.setBounds({x:300+i*20,y:160,width:1100,height:700})}
win.maximize();const normal=win.getNormalBounds();await manager.setMode('fullscreen');await manager.setMode('windowed');assert.equal(win.isMaximized(),true);assert.deepEqual(win.getNormalBounds(),normal);
win.unmaximize();win.setBounds({x:2200,y:100,width:1100,height:700});await manager.setMode('fullscreen');work={x:0,y:0,width:1280,height:720};await manager.setMode('windowed');assert.deepEqual(win.bounds,{x:180,y:20,width:1100,height:700});
console.log('Native window restore: repeated fullscreen, exact geometry, maximized state and removed monitor clamping passed');
})().catch(e=>{console.error(e);process.exitCode=1});
