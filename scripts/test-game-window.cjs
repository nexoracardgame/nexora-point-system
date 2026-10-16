const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),{EventEmitter}=require('node:events');
const handlers={},windows=[];
class Window extends EventEmitter{
 constructor(options){super();this.options=options;this.webContents=new EventEmitter();this.webContents.setWindowOpenHandler=()=>{};this.webContents.send=()=>{};windows.push(this)}
 isDestroyed(){return false}loadURL(){return Promise.resolve()}setTitle(){}show(){}focus(){}maximize(){this.maximized=true}unmaximize(){this.maximized=false}isMaximized(){return !!this.maximized}isFullScreen(){return !!this.fullscreen}setFullScreen(value){this.fullscreen=value}minimize(){this.minimized=true}close(){this.closed=true}
 static getAllWindows(){return windows}
}
const app=new EventEmitter();Object.assign(app,{isPackaged:true,setName(){},setAppUserModelId(){},setPath(){},getPath:()=>'/appdata',requestSingleInstanceLock:()=>true,whenReady:()=>Promise.resolve(),setAsDefaultProtocolClient(){},getVersion:()=> '1.0.1',quit(){}});
const electron={app,BrowserWindow:Window,Menu:{setApplicationMenu(){}},dialog:{showErrorBox(){}},ipcMain:{handle:(name,fn)=>handlers[name]=fn},shell:{openExternal:async()=>{}},session:{defaultSession:{setPermissionRequestHandler(){}}}};
const updater=new EventEmitter();updater.checkForUpdates=async()=>{};
vm.runInNewContext(fs.readFileSync('desktop/main.cjs','utf8'),{require:id=>id==='electron'?electron:id==='electron-updater'?{autoUpdater:updater}:id==='./package.json'?{gameOnly:true}:require(id),__dirname:require('node:path').resolve('desktop'),process:{env:{},argv:[],platform:'win32',on(){}},URL,setTimeout(){},setInterval(){},console});
(async()=>{await new Promise(resolve=>setImmediate(resolve));const win=windows[0];assert.equal(win.options.fullscreen,false);assert.equal(win.options.frame,false);assert.equal(win.options.webPreferences.sandbox,true);win.emit('ready-to-show');assert.equal(win.maximized,true);
 const invoke=action=>handlers['nexora:window-control']({sender:win.webContents,senderFrame:{url:'https://nexora-point-system.vercel.app/game'}},action);
 assert.equal(invoke('minimize'),true);assert.equal(win.minimized,true);invoke('resize');assert.equal(win.maximized,false);invoke('resize');assert.equal(win.maximized,true);invoke('close');assert.equal(win.closed,true);
 assert.equal(handlers['nexora:window-control']({sender:win.webContents,senderFrame:{url:'https://evil.test'}},'close'),false);assert.equal(invoke('unknown'),false);
 console.log('Native game window passed: maximized not fullscreen, sandbox, minimize/restore/maximize/close, trusted sender validation');
})().catch(error=>{console.error(error);process.exitCode=1});
