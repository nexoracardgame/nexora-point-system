import sharp from 'sharp';
import { mkdir, copyFile, writeFile } from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const folder='public/game-icons';
const branding='public/game-assets/branding';
await mkdir(folder,{recursive:true});
await mkdir(branding,{recursive:true});
const input=process.argv[2]||`${branding}/app-icon.png`;
const pixels=await sharp(input).resize(1024,1024,{fit:'contain',background:{r:0,g:0,b:0,alpha:0}}).ensureAlpha().raw().toBuffer();
const version=createHash('sha256').update(pixels).digest('hex').slice(0,16);
const source=await sharp(pixels,{raw:{width:1024,height:1024,channels:4}}).png().toBuffer();
await writeFile(`${branding}/app-icon.png`,source);
await writeFile(`${folder}/emblem.png`,source);
const icons={};
for(const size of [16,24,32,48,64,128,180,192,256,512]){
 const buffer=await sharp(source).resize(size,size).png().toBuffer();
 await writeFile(`${branding}/icon-${size}.png`,buffer);
 if([16,32,48,192,512].includes(size))await writeFile(`${folder}/icon-${size}.png`,buffer);
 icons[size]=`/game-assets/branding/icon-${size}.png`;
}
execFileSync(process.execPath,['scripts/generate-electron-assets.mjs','--game'],{stdio:'inherit'});
await copyFile(`${folder}/favicon.ico`,`${branding}/favicon.ico`);
await writeFile(`${branding}/icon-set.json`,JSON.stringify({version,source:'/game-assets/branding/app-icon.png',favicon:'/game-assets/branding/favicon.ico',icons},null,2)+'\n');
console.log(`Game PNG, browser ICO and native ICO generated from one source: ${version}`);
