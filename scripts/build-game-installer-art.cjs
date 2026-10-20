const fs=require('node:fs'),path=require('node:path'),sharp=require('sharp');
const root='public/game-assets/installer',native='desktop/assets/game-setup';
function bmp(data,width,height){
 const stride=(width*3+3)&~3,buffer=Buffer.alloc(54+stride*height);
 buffer.write('BM');buffer.writeUInt32LE(buffer.length,2);buffer.writeUInt32LE(54,10);buffer.writeUInt32LE(40,14);buffer.writeInt32LE(width,18);buffer.writeInt32LE(height,22);buffer.writeUInt16LE(1,26);buffer.writeUInt16LE(24,28);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){const from=(y*width+x)*3,to=54+(height-y-1)*stride+x*3;buffer[to]=data[from+2];buffer[to+1]=data[from+1];buffer[to+2]=data[from];}return buffer;
}
async function bitmap(source,file,width,height){const data=await sharp(source).resize(width,height,{fit:'fill'}).flatten({background:'#080b0e'}).removeAlpha().raw().toBuffer();fs.writeFileSync(file,bmp(data,width,height));}
(async()=>{
 fs.mkdirSync(root,{recursive:true});fs.mkdirSync(native,{recursive:true});
 if(process.argv[2])await sharp(process.argv[2]).resize(1600,900,{fit:'cover'}).webp({quality:92}).toFile(root+'/wallpaper.webp');
 if(!fs.existsSync(root+'/wallpaper.webp'))throw Error('Installer wallpaper source required');
 const logo=await sharp('public/images/triad/nexora-official-logo.webp').resize(250,100,{fit:'inside'}).png().toBuffer();
 const overlay=Buffer.from('<svg width="1000" height="600"><defs><linearGradient id="s" x2="0" y2="1"><stop stop-color="#020508" stop-opacity=".25"/><stop offset="1" stop-color="#020508" stop-opacity=".95"/></linearGradient></defs><rect width="1000" height="600" fill="url(#s)"/><rect x="1" y="1" width="998" height="598" rx="6" fill="none" stroke="#b99b60" stroke-opacity=".6"/></svg>');
 const scene=await sharp(root+'/wallpaper.webp').resize(1000,600).composite([{input:overlay},{input:logo,left:28,top:22}]).png().toBuffer();
 await sharp(scene).webp({lossless:true}).toFile(root+'/wizard.webp');
 await bitmap(scene,native+'/wallpaper.bmp',1000,600);
 const sidebar=await sharp(root+'/wallpaper.webp').resize(328,628,{fit:'cover',position:sharp.strategy.attention}).png().toBuffer();
 await bitmap(sidebar,native+'/sidebar.bmp',328,628);
 for(const label of ['INSTALL','UNINSTALL'])for(let frame=0;frame<16;frame++){
  const stroke=frame===0?'#b99b60':'#ffe5a1',offset=frame*48;
  const svg=Buffer.from(`<svg width="400" height="100"><rect x="3" y="3" width="394" height="94" rx="5" fill="#080b0e" stroke="#b99b60" stroke-width="2"/><rect x="4" y="4" width="392" height="92" rx="4" fill="none" stroke="${stroke}" stroke-width="5" stroke-dasharray="110 858" stroke-dashoffset="-${offset}"/><text x="200" y="61" text-anchor="middle" font-family="Arial" font-size="29" font-weight="700" fill="#ffe5a1">${label}</text></svg>`);
  const png=await sharp(svg).png().toBuffer();
  await bitmap(png,`${native}/${label.toLowerCase()}-${frame}.bmp`,400,100);
 }
 console.log('Generated shared install/uninstall artwork and gold-edge animation frames');
})().catch(error=>{console.error(error);process.exitCode=1});
