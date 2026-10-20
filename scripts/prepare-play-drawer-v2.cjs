const fs=require('node:fs'),path=require('node:path'),sharp=require('sharp');
const source=process.argv[2];
if(!source)throw Error('Expected source PNG path');
const directory=path.resolve('public/game-assets/ui/play-drawer-v2');
(async()=>{fs.mkdirSync(directory,{recursive:true});await sharp(source).webp({lossless:true}).toFile(path.join(directory,'drawer.webp'));console.log('Prepared original three-mode PLAY art as lossless registered resource');})().catch(error=>{console.error(error);process.exitCode=1});
