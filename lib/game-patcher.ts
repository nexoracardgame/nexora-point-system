export type GameRelease = {version:string;authEpoch:number;minimumDesktopVersion:string;totalBytes:number;resources:{url:string;bytes:number;sha256:string}[];manualDownload?:{kind:'critical-patch'|'addon';title:string}};
export type PatchProgress = {file:string;downloaded:number;total:number;completed:number;count:number};
export async function hasPendingLobbyDownload(release:GameRelease){
 // Ordinary game assets and an empty browser cache are not downloadable updates.
 const notice=release.manualDownload;
 if(!notice||!['critical-patch','addon'].includes(notice.kind)||typeof notice.title!=='string'||!notice.title.trim()||!Array.isArray(release.resources)||!release.resources.length||typeof caches==='undefined')return false;
 return hasPendingGameResources(release);
}
export async function hasPendingGameResources(release:GameRelease){
 const pointer=await (await caches.open('nexora-game-release')).match('/game/release-pointer');
 if(!pointer)return true;
 const installed=await pointer.json();if(installed.version!==release.version||!installed.cacheName)return true;
 const cache=await caches.open(installed.cacheName);
 for(const resource of release.resources)if(installed.hashes?.[resource.url]!==resource.sha256||!await cache.match(resource.url))return true;
 return false;
}
export async function installGameResources(release:GameRelease,onProgress:(progress:PatchProgress)=>void,signal?:AbortSignal) {
  if(!/^[a-zA-Z0-9-]+$/.test(release.version)||release.totalBytes!==release.resources.reduce((sum,r)=>sum+r.bytes,0)||!release.resources.length)throw Error('Invalid game release');
  const cacheName=`nexora-game-resources-${release.version}`;
  const cache=await caches.open(cacheName);
  const pointerCache=await caches.open('nexora-game-release');
  const oldPointer=await pointerCache.match('/game/release-pointer');
  const previous=oldPointer?await oldPointer.json():null;
  const previousCache=previous?.cacheName?await caches.open(previous.cacheName):null;
  for(const resource of release.resources){
    if(!/^\/(images|cards|videos|audio|fonts)\//.test(resource.url)||resource.url.includes('..')||!Number.isSafeInteger(resource.bytes)||resource.bytes<=0||!/^[a-f0-9]{64}$/.test(resource.sha256))throw Error('Invalid game resource');
  }
  let downloaded=0,completed=0,cursor=0,failed=false;
  const download=async(resource:GameRelease['resources'][number])=>{
    signal?.throwIfAborted();
    if(!/^\/(images|cards|videos|audio|fonts)\//.test(resource.url)||resource.url.includes('..')||!Number.isSafeInteger(resource.bytes)||resource.bytes<=0||!/^[a-f0-9]{64}$/.test(resource.sha256))throw Error('Invalid game resource');
    const report=()=>onProgress({file:resource.url,downloaded,total:release.totalBytes,completed,count:release.resources.length});
    report();
    const cached=await cache.match(resource.url);
    if(cached){downloaded+=resource.bytes;completed++;report();return;}
    if(previous?.hashes?.[resource.url]===resource.sha256&&previousCache){const reusable=await previousCache.match(resource.url);if(reusable){await cache.put(resource.url,reusable);downloaded+=resource.bytes;completed++;report();return;}}
    const response=await fetch(resource.url+`?patch=${release.version}`,{cache:'no-store',signal});
    if(!response.ok||!response.body)throw Error(`ดาวน์โหลดไม่สำเร็จ: ${resource.url}`);
    const reader=response.body.getReader(),chunks:Uint8Array<ArrayBuffer>[]=[];let bytes=0;
    while(true){const {done,value}=await reader.read();if(done)break;chunks.push(value);bytes+=value.length;downloaded+=value.length;report();}
    if(bytes!==resource.bytes)throw Error(`ไฟล์ไม่ครบ: ${resource.url}`);
    const blob=new Blob(chunks);const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',await blob.arrayBuffer()))].map(b=>b.toString(16).padStart(2,'0')).join('');
    if(hash!==resource.sha256)throw Error(`ตรวจสอบไฟล์ไม่ผ่าน: ${resource.url}`);
    await cache.put(resource.url,new Response(blob,{headers:{'Content-Type':response.headers.get('Content-Type')||'application/octet-stream'}}));completed++;report();
  };
  // Bound concurrency to avoid holding too many large video parts in memory.
  const workers=await Promise.allSettled(Array.from({length:Math.min(4,release.resources.length)},async()=>{
    while(!failed&&cursor<release.resources.length){const resource=release.resources[cursor++];try{await download(resource)}catch(error){failed=true;throw error}}
  }));
  const failure=workers.find(result=>result.status==='rejected');
  if(failure?.status==='rejected')throw failure.reason;
  signal?.throwIfAborted();
  await pointerCache.put('/game/release-pointer',Response.json({cacheName,version:release.version,authEpoch:release.authEpoch,hashes:Object.fromEntries(release.resources.map(r=>[r.url,r.sha256]))}));
  for(const name of await caches.keys())if(name.startsWith('nexora-game-resources-')&&name!==cacheName)await caches.delete(name);
}
