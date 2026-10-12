const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');
(async () => {
  const output = path.resolve('public/battle-arenas');
  fs.mkdirSync(output,{recursive:true});
  for(const element of ['fire','water','earth','wood','gold']){
    const input = path.resolve('artifacts/triad-arena-source',element+'.png');
    const metadata = await sharp(input).metadata();
    await sharp(input).webp({quality:88,effort:6}).toFile(path.join(output,element+'.webp'));
    console.log(`${element}: ${metadata.width}x${metadata.height}, ${fs.statSync(path.join(output,element+'.webp')).size} bytes`);
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
