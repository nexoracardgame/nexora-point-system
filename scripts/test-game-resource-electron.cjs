const {app,BrowserWindow,session}=require('electron'),path=require('node:path'),fs=require('node:fs/promises'),assert=require('node:assert/strict'),{createHash}=require('node:crypto');
const {createGameResourceHandler}=require('../desktop/game-resource-pack.cjs');
app.whenReady().then(async()=>{let win;try{
 const root=path.resolve('dist/game-desktop/win-unpacked/resources/game-resources'),release=JSON.parse(await fs.readFile(path.join(root,'game-release.json'),'utf8'));
 for(const resource of release.resources){const bytes=await fs.readFile(path.join(root,resource.url));assert.equal(bytes.length,resource.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),resource.sha256)}
 let network=0;const handler=createGameResourceHandler({root,release,origin:'https://resource.test',fetchNetwork:async request=>{if(new URL(request.url).pathname==='/')return new Response('<html><body>Native pack test</body></html>',{headers:{'Content-Type':'text/html'}});network++;throw Error('Network disabled: '+request.url)}});
 session.defaultSession.protocol.handle('https',handler);win=new BrowserWindow({show:false,webPreferences:{contextIsolation:true,sandbox:true}});await win.loadURL('https://resource.test/');const thumbnails=release.resources.filter(file=>file.url.startsWith('/cards/thumbnails/')).map(file=>file.url+'?patch='+release.version);
 const count=await win.webContents.executeJavaScript(`(async()=>{let count=0;for(const src of ${JSON.stringify(thumbnails)}){await new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>img.decode().then(resolve,reject);img.onerror=()=>reject(Error(src));img.src=src});count++}return count})()`);assert.equal(count,293);assert.equal(network,0);console.log('REAL ELECTRON: all '+release.resources.length+' bundled files verified; 293 images decoded from disk with network disabled');
 win.destroy();app.quit();
 }catch(error){console.error(error);win?.destroy();app.exit(1)}});
