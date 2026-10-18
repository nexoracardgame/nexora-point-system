const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{EventEmitter}=require('node:events');
const {manageGameWindow,readWindowState}=require('../desktop/game-window-state.cjs');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'nexora-window-')),file=path.join(dir,'state.json');
let work={x:0,y:0,width:1920,height:1040};const screen={getDisplayMatching:()=>({workArea:work})};
class Window extends EventEmitter{
 constructor(bounds){super();this.bounds={...bounds};this.normal={...bounds};this.full=false;this.max=false;this.min=false}
 getBounds(){return {...this.bounds}}getNormalBounds(){return {...this.normal}}isMaximized(){return this.max}isFullScreen(){return this.full}isMinimized(){return this.min}isDestroyed(){return false}
 setBounds(b){this.bounds={...b};this.normal={...b};this.emit('resize');this.emit('move')}
}
try{
 assert.equal(readWindowState(file,screen),null);
 let bounds={x:140,y:95,width:1020,height:620};
 for(let i=0;i<5;i++){const initial=readWindowState(file,screen),win=new Window(initial?.bounds||bounds);manageGameWindow(win,screen,{file,initial:initial||undefined});if(initial)assert.deepEqual(win.bounds,bounds);bounds={x:160+i*15,y:110+i*10,width:1050+i*20,height:650+i*10};win.setBounds(bounds);win.emit('close');assert.deepEqual(readWindowState(file,screen),{bounds,maximized:false})}
 const saved=readWindowState(file,screen),full=new Window(saved.bounds);manageGameWindow(full,screen,{file,initial:saved});full.full=true;full.bounds={x:0,y:0,width:1920,height:1080};full.emit('resize');full.emit('close');assert.deepEqual(readWindowState(file,screen),saved,'Closing fullscreen preserves normal geometry');
 const max=new Window(bounds);max.max=true;manageGameWindow(max,screen,{file});max.emit('close');assert.equal(readWindowState(file,screen).maximized,true);
 work={x:0,y:0,width:1280,height:720};assert.ok(readWindowState(file,screen).bounds.x+readWindowState(file,screen).bounds.width<=1280);
 fs.writeFileSync(file,'broken');assert.equal(readWindowState(file,screen),null);fs.writeFileSync(file,JSON.stringify({bounds:{x:0,y:0,width:-1,height:600}}));assert.equal(readWindowState(file,screen),null);
 assert.ok(!fs.readFileSync('desktop/main.cjs','utf8').includes('if (GAME_ONLY) mainWindow.maximize()'));
 console.log('Window restart persistence: five reopen cycles, exact bounds, fullscreen close, maximized state, monitor changes and invalid file fallback passed');
}finally{for(const name of ['state.json','state.json.tmp']){const target=path.join(dir,name);if(fs.existsSync(target))fs.unlinkSync(target)}fs.rmdirSync(dir)}
