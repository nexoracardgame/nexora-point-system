const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const source=process.argv[2];if(!source)throw Error('Pass original first 4K MP4');
const root='public/videos/nexora-login-4k';fs.mkdirSync(root,{recursive:true});
const original=fs.readFileSync(source),parts=[];
for(let offset=0;offset<original.length;offset+=32*1024*1024){const name=`part-${parts.length}.bin`;fs.writeFileSync(path.join(root,name),original.subarray(offset,offset+32*1024*1024));parts.push(name)}
const hash=data=>crypto.createHash('sha256').update(data).digest('hex');
if(hash(Buffer.concat(parts.map(part=>fs.readFileSync(path.join(root,part)))))!==hash(original))throw Error('Original bytes differ');
fs.writeFileSync(path.join(root,'manifest.json'),JSON.stringify({width:3840,height:2160,bytes:original.length,sha256:hash(original),parts},null,2));
console.log('Login video split and reassembled SHA256 verified, '+original.length+' original bytes');
