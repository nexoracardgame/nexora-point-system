export type GameRelease = {version:string;authEpoch:number;minimumDesktopVersion:string;totalBytes:number;resources:{url:string;bytes:number;sha256:string}[]};
export type PatchProgress = {file:string;downloaded:number;total:number;completed:number;count:number};
export async function installGameResources(release:GameRelease,onProgress:(progress:PatchProgress)=>void,signal?:AbortSignal) {
  if(!/^[a-zA-Z0-9-]+$/.test(release.version)||release.totalBytes!==release.resources.reduce((sum,r)=>sum+r.bytes,0)||!release.resources.length)throw Error('Invalid game release');
  const cacheName=`nexora-game-resources-${release.version}`;
  const cache=await caches.open(cacheName);
  const pointerCache=await caches.open('nexora-game-release');
  const oldPointer=await pointerCache.match('/game/release-pointer');
  const previous=oldPointer?await oldPointer.json():null;
  const previousCache=previous?.cacheName?await caches.open(previous.cacheName):null;
  let downloaded=0,completed=0;
  for(const resource of release.resources){
    signal?.throwIfAborted();
    if(!/^\/(images|cards|videos|audio|fonts)\//.test(resource.url)||resource.url.includes('..')||!Number.isSafeInteger(resource.bytes)||resource.bytes<=0||!/^[a-f0-9]{64}$/.test(resource.sha256))throw Error('Invalid game resource');
    const report=()=>onProgress({file:resource.url,downloaded,total:release.totalBytes,completed,count:release.resources.length});
    report();
    const cached=await cache.match(resource.url);
    if(cached){downloaded+=resource.bytes;completed++;report();continue;}
    if(previous?.hashes?.[resource.url]===resource.sha256&&previousCache){const reusable=await previousCache.match(resource.url);if(reusable){await cache.put(resource.url,reusable);downloaded+=resource.bytes;completed++;report();continue;}}
    const response=await fetch(resource.url+`?patch=${release.version}`,{cache:'no-store',signal});
    if(!response.ok||!response.body)throw Error(`ดาวน์โหลดไม่สำเร็จ: ${resource.url}`);
    const reader=response.body.getReader(),chunks:Uint8Array<ArrayBuffer>[]=[];let bytes=0;
    while(true){const {done,value}=await reader.read();if(done)break;chunks.push(value);bytes+=value.length;downloaded+=value.length;report();}
    if(bytes!==resource.bytes)throw Error(`ไฟล์ไม่ครบ: ${resource.url}`);
    const blob=new Blob(chunks);const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',await blob.arrayBuffer()))].map(b=>b.toString(16).padStart(2,'0')).join('');
    if(hash!==resource.sha256)throw Error(`ตรวจสอบไฟล์ไม่ผ่าน: ${resource.url}`);
    await cache.put(resource.url,new Response(blob,{headers:{'Content-Type':response.headers.get('Content-Type')||'application/octet-stream'}}));completed++;report();
  }
  await pointerCache.put('/game/release-pointer',Response.json({cacheName,version:release.version,authEpoch:release.authEpoch,hashes:Object.fromEntries(release.resources.map(r=>[r.url,r.sha256]))}));
  for(const name of await caches.keys())if(name.startsWith('nexora-game-resources-')&&name!==cacheName)await caches.delete(name);
}
