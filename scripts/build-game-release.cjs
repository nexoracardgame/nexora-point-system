const fs=require('node:fs'),path=require('node:path'),{createHash}=require('node:crypto');
const root=path.resolve('public'),files=new Set();
for(const dir of ['images/versus','images/target-ui','images/mode-ui-v3','images/game-login','audio/ui','fonts/orbitron']){
 const base=path.join(root,dir);if(fs.existsSync(base))for(const name of fs.readdirSync(base))if(!name.endsWith('-source.png')&&fs.statSync(path.join(base,name)).isFile())files.add('/'+dir+'/'+name);
}
for(const name of ['images/triad/nexora-official-logo.webp','images/triad/lobby-action-sprite.webp','images/triad/nexora-command-original.webp','audio/music/nexora-menu.mp3','cards/card-backs/card-backs.png'])if(fs.existsSync(path.join(root,name)))files.add('/'+name);
const cards=JSON.parse(fs.readFileSync('public/cards/card-skill-db.json','utf8'));
function visit(value){if(!value||typeof value!=='object')return;for(const [key,item]of Object.entries(value)){if(key==='sourceImage'&&typeof item==='string'&&item.startsWith('/')&&fs.existsSync(path.join(root,item)))files.add(item);else if(typeof item==='object')visit(item)}}visit(cards);
const wallpaperPath='public/videos/nexora-home-4k/manifest.json';if(fs.existsSync(wallpaperPath)){const wallpaper=JSON.parse(fs.readFileSync(wallpaperPath));files.add('/videos/nexora-home-4k/manifest.json');for(const part of wallpaper.parts)files.add('/videos/nexora-home-4k/'+part);}
const settings=JSON.parse(fs.readFileSync('data/game-release.json','utf8'));
const resources=[...files].sort().map(url=>{const data=fs.readFileSync(path.join(root,url));return{url,bytes:data.length,sha256:createHash('sha256').update(data).digest('hex')}});
const version=createHash('sha256').update(JSON.stringify({settings,resources})).digest('hex').slice(0,20);
fs.writeFileSync('public/game-release.json',JSON.stringify({...settings,version,totalBytes:resources.reduce((n,r)=>n+r.bytes,0),resources}));
console.log(`Game patch ${version}: ${resources.length} files, ${resources.reduce((n,r)=>n+r.bytes,0)} bytes`);
