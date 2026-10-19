const fs=require('node:fs'),path=require('node:path'),{createHash}=require('node:crypto'),{execFileSync}=require('node:child_process');
const [source,ffmpeg,folder='home-loop']=process.argv.slice(2);
if(!source||!ffmpeg)throw Error('Usage: node scripts/prepare-home-loop.cjs <master.mp4> <ffmpeg.exe>');
if(!/^[a-z0-9-]+$/.test(folder))throw Error('Invalid resource folder');
const root='public/game-assets/video/'+folder,urlRoot='/game-assets/video/'+folder;
fs.mkdirSync(root,{recursive:true});
const variants=[];
for(const [name,width,height,bitrate,maxrate,cq]of [['4k',3840,2160,'10M','14M','23'],['1080p',1920,1080,'3M','5M','24'],['720p',1280,720,'1500k','2200k','25']]){
 const temporary=path.join(root,`loop-${name}.mp4`);
 execFileSync(ffmpeg,['-hide_banner','-loglevel','error','-i',source,'-map','0:v:0','-an','-vf',`scale=${width}:${height}:flags=lanczos,setsar=1`,'-c:v','h264_nvenc','-preset','p6','-rc','vbr','-cq',cq,'-b:v',bitrate,'-maxrate',maxrate,'-bufsize',maxrate,'-profile:v','high','-pix_fmt','yuv420p','-g','48','-movflags','+faststart','-y',temporary],{stdio:'inherit'});
 const bytes=fs.readFileSync(temporary),sha256=createHash('sha256').update(bytes).digest('hex'),nameWithHash=`loop-${name}-${sha256.slice(0,12)}.mp4`;
 fs.renameSync(temporary,path.join(root,nameWithHash));variants.push({width,height,url:urlRoot+'/'+nameWithHash,bytes:bytes.length,sha256});
 console.log(`${name}: ${bytes.length} bytes`);
}
const poster=path.join(root,'poster.webp');
execFileSync(ffmpeg,['-hide_banner','-loglevel','error','-i',source,'-frames:v','1','-vf','scale=1920:1080:flags=lanczos','-c:v','libwebp','-quality','82','-y',poster],{stdio:'inherit'});
const posterName=`poster-${createHash('sha256').update(fs.readFileSync(poster)).digest('hex').slice(0,12)}.webp`;fs.renameSync(poster,path.join(root,posterName));
fs.writeFileSync(path.join(root,'manifest.json'),JSON.stringify({schemaVersion:1,poster:urlRoot+'/'+posterName,variants},null,2)+'\n');
