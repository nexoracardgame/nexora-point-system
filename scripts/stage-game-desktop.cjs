const fs=require('node:fs'),path=require('node:path');
const source='dist/game-desktop',destination='public/downloads/game-windows';fs.mkdirSync(destination,{recursive:true});
for(const name of ['NEXORA-CARD-GAME-Setup-1.0.0.exe','NEXORA-CARD-GAME-Setup-1.0.0.exe.blockmap','latest.yml']){
 const file=path.join(source,name);if(!fs.existsSync(file))throw Error('Missing '+file);
 if(fs.statSync(file).size>=100*1024*1024)throw Error('Artifact exceeds GitHub single-file limit');
 fs.copyFileSync(file,path.join(destination,name));
}console.log('Staged dedicated game installer and updater feed');
