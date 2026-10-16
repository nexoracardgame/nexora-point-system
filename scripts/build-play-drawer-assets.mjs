import sharp from 'sharp';
import {mkdir,copyFile} from 'node:fs/promises';

const out='public/images/lobby-play';
await mkdir(out,{recursive:true});
const source=`${out}/drawer-source.png`;
if(process.argv.includes('--import'))await copyFile('C:/Users/USER/Downloads/fbb441ad-2c37-465c-8f44-65fdd90f66a7.png',source);
await sharp(source).webp({quality:94,alphaQuality:100}).toFile(`${out}/drawer.webp`);
const pieces={triad:[172,365,525,125],pentad:[172,492,580,126],public:[149,642,337,84],private:[439,642,338,84],create:[682,608,670,184]};
for(const [name,[left,top,width,height]]of Object.entries(pieces))await sharp(source).extract({left,top,width,height}).webp({quality:96,alphaQuality:100}).toFile(`${out}/${name}.webp`);
console.log('PLAY drawer and five exact artwork crops generated');
