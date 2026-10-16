import sharp from 'sharp';
import { mkdir, copyFile } from 'node:fs/promises';
const folder='public/game-icons';
await mkdir(folder,{recursive:true});
if(process.argv[2])await copyFile(process.argv[2],`${folder}/emblem.png`);
for(const size of [16,32,48,192,512])await sharp(`${folder}/emblem.png`).resize(size,size,{fit:'contain',background:{r:0,g:0,b:0,alpha:0}}).png().toFile(`${folder}/icon-${size}.png`);
console.log('Game-only transparent PNG icon sizes generated');
