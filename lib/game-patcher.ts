import {isGameResourceUrl} from './game-resource-policy';
export type GameRelease = {version:string;authEpoch:number;minimumDesktopVersion:string;totalBytes:number;resources:{url:string;bytes:number;sha256:string;mimeType?:string}[];manualDownload?:{kind:'critical-patch'|'addon';title:string}};
export type PatchProgress = {file:string;downloaded:number;total:number;completed:number;count:number;networkBytes?:number;reusedBytes?:number;bytesPerSecond?:number};
type DownloadDevice={deviceMemory?:number;hardwareConcurrency?:number;connection?:{effectiveType?:string;downlink?:number}};
export function gameDownloadLimits(device:DownloadDevice=typeof navigator==='undefined'?{}:navigator as DownloadDevice){
 const lowMemory=(device.deviceMemory??4)<=2,slow=/^(slow-2g|2g)$/.test(device.connection?.effectiveType||'');
 const fast=!lowMemory&&((device.deviceMemory??0)>=8||(device.connection?.downlink??0)>=10);
 return {concurrency:slow?4:lowMemory?8:fast?24:16,memoryBytes:(lowMemory?32:(device.deviceMemory??4)>=8?160:96)*1048576,largeFiles:lowMemory?1:2};
}
export async function prepareGameResourceWorker(){
 if(!('serviceWorker' in navigator)||typeof caches==='undefined')throw Error('อุปกรณ์นี้ไม่รองรับการจัดเก็บทรัพยากรเกม');
 const registration=await navigator.serviceWorker.register('/sw.js',{scope:'/',updateViaCache:'none'});
 const incoming=registration.installing||registration.waiting;
 if(incoming&&incoming.state!=='activated')await new Promise<void>((resolve,reject)=>{const finish=()=>{if(incoming.state==='activated'||incoming.state==='redundant'){clearTimeout(timer);incoming.removeEventListener('statechange',finish);if(incoming.state==='activated')resolve();else reject(Error('อัปเดตระบบทรัพยากรไม่สำเร็จ'))}};const timer=setTimeout(()=>{incoming.removeEventListener('statechange',finish);reject(Error('เปิดระบบทรัพยากรไม่สำเร็จ กรุณาลองอีกครั้ง'))},10000);incoming.addEventListener('statechange',finish);finish()});
 await navigator.serviceWorker.ready;
 if(!navigator.serviceWorker.controller||navigator.serviceWorker.controller.state!=='activated')await new Promise<void>((resolve,reject)=>{const changed=()=>{if(navigator.serviceWorker.controller?.state==='activated'){clearTimeout(timer);navigator.serviceWorker.removeEventListener('controllerchange',changed);resolve()}};const timer=setTimeout(()=>{navigator.serviceWorker.removeEventListener('controllerchange',changed);reject(Error('เปิดระบบทรัพยากรไม่สำเร็จ กรุณาลองอีกครั้ง'))},10000);navigator.serviceWorker.addEventListener('controllerchange',changed);changed()});
}
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
 const keys=typeof cache.keys==='function'?new Set((await cache.keys()).map(request=>new URL(request.url).pathname)):null;
 for(const resource of release.resources)if(installed.hashes?.[resource.url]!==resource.sha256||(keys?!keys.has(resource.url):!await cache.match(resource.url)))return true;
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
    if(!isGameResourceUrl(resource.url)||!Number.isSafeInteger(resource.bytes)||resource.bytes<=0||!/^[a-f0-9]{64}$/.test(resource.sha256))throw Error('Invalid game resource');
  }
  const limits=gameDownloadLimits(),controller=new AbortController(),active=new Map<string,number>();
  const abort=()=>controller.abort(signal?.reason);signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();
  let completedBytes=0,completed=0,networkBytes=0,reusedBytes=0,lastReport=-Infinity,networkStarted=0,file='';
  const report=(force=false)=>{
    const now=performance.now();if(!force&&now-lastReport<100)return;lastReport=now;
    onProgress({file,downloaded:Math.min(release.totalBytes,completedBytes+[...active.values()].reduce((sum,value)=>sum+value,0)),total:release.totalBytes,completed,count:release.resources.length,networkBytes,reusedBytes,bytesPerSecond:networkStarted?networkBytes/Math.max(1,now-networkStarted)*1000:0});
  };
  const hash=async(bytes:ArrayBuffer)=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(value=>value.toString(16).padStart(2,'0')).join('');
  const valid=async(response:Response,resource:GameRelease['resources'][number])=>{const bytes=await response.arrayBuffer();return bytes.byteLength===resource.bytes&&await hash(bytes)===resource.sha256?bytes:null};
  const delay=(ms:number)=>new Promise<void>((resolve,reject)=>{const stop=()=>{clearTimeout(timer);controller.signal.removeEventListener('abort',stop);reject(controller.signal.reason)};const timer=setTimeout(()=>{controller.signal.removeEventListener('abort',stop);resolve()},ms);controller.signal.addEventListener('abort',stop,{once:true});if(controller.signal.aborted)stop()});
  class FetchError extends Error{constructor(message:string,readonly retryable:boolean){super(message)}}
  const receive=async(resource:GameRelease['resources'][number])=>{
    for(let attempt=0;;attempt++){
      controller.signal.throwIfAborted();const request=new AbortController();const stop=()=>request.abort(controller.signal.reason);controller.signal.addEventListener('abort',stop,{once:true});
      let timer:ReturnType<typeof setTimeout>;const heartbeat=()=>{clearTimeout(timer);timer=setTimeout(()=>request.abort(Error('การดาวน์โหลดหยุดตอบสนอง')),30000)};heartbeat();
      try{
        const response=await fetch(resource.url+`?patch=${release.version}`,{cache:'no-store',signal:request.signal});
        if(!response.ok||!response.body)throw new FetchError(`ดาวน์โหลดไม่สำเร็จ: ${resource.url}`,response.status===408||response.status===429||response.status>=500);
        const local=response.headers.get('X-Nexora-Resource')==='installed-pack';if(!local&&!networkStarted)networkStarted=performance.now();
        const reader=response.body.getReader(),bytes=new Uint8Array(resource.bytes);let offset=0;
        try{
          while(true){const {done,value}=await reader.read();if(done)break;heartbeat();if(offset+value.length>bytes.length)throw new FetchError(`ขนาดไฟล์ไม่ถูกต้อง: ${resource.url}`,false);bytes.set(value,offset);offset+=value.length;if(!local)networkBytes+=value.length;active.set(resource.url,offset);file=resource.url;report()}
        }finally{await reader.cancel().catch(()=>{});reader.releaseLock()}
        if(offset!==resource.bytes)throw new FetchError(`ไฟล์ไม่ครบ: ${resource.url}`,true);
        if(await hash(bytes.buffer)!==resource.sha256)throw new FetchError(`ตรวจสอบไฟล์ไม่ผ่าน: ${resource.url}`,false);
        return {bytes,local,mime:resource.mimeType||response.headers.get('Content-Type')||'application/octet-stream'};
      }catch(error){
        active.delete(resource.url);
        if(controller.signal.aborted||attempt>=2||(error instanceof FetchError&&!error.retryable))throw error;
        await delay(250*2**attempt);
      }finally{clearTimeout(timer!);controller.signal.removeEventListener('abort',stop)}
    }
  };
  const download=async(resource:GameRelease['resources'][number])=>{
    controller.signal.throwIfAborted();file=resource.url;report();
    const cached=await cache.match(resource.url);
    if(cached&&await valid(cached,resource)){reusedBytes+=resource.bytes;completedBytes+=resource.bytes;completed++;report();return}
    if(previous?.hashes?.[resource.url]===resource.sha256&&previousCache){const reusable=await previousCache.match(resource.url);if(reusable){const bytes=await valid(reusable,resource);if(bytes){controller.signal.throwIfAborted();const headers=new Headers(reusable.headers);if(resource.mimeType)headers.set('Content-Type',resource.mimeType);await cache.put(resource.url,new Response(bytes,{headers}));reusedBytes+=resource.bytes;completedBytes+=resource.bytes;completed++;report();return}}}
    const result=await receive(resource);controller.signal.throwIfAborted();
    await cache.put(resource.url,new Response(result.bytes,{headers:{'Content-Type':result.mime}}));
    active.delete(resource.url);if(result.local)reusedBytes+=resource.bytes;completedBytes+=resource.bytes;completed++;report();
  };
  // Start long transfers early, filling spare memory/slots with smaller files.
  const queue=[...release.resources].sort((a,b)=>b.bytes-a.bytes),running=new Set<Promise<void>>();
  let reserved=0,large=0,failed=false,failure:unknown;
  report(true);
  try{
    while(queue.length||running.size){
      controller.signal.throwIfAborted();
      while(!failed&&queue.length&&running.size<limits.concurrency){
        const index=queue.findIndex(resource=>running.size===0||(reserved+resource.bytes<=limits.memoryBytes&&(resource.bytes<=16*1048576||large<limits.largeFiles)));
        if(index<0)break;
        const resource=queue.splice(index,1)[0],isLarge=resource.bytes>16*1048576;reserved+=resource.bytes;if(isLarge)large++;
        let task:Promise<void>;task=download(resource).catch(error=>{if(!failed){failed=true;failure=error;controller.abort(error)}}).finally(()=>{reserved-=resource.bytes;if(isLarge)large--;running.delete(task)});running.add(task);
      }
      if(running.size)await Promise.race(running);
      if(failed)throw failure;
    }
    controller.signal.throwIfAborted();report(true);
  }catch(error){controller.abort(error);await Promise.allSettled([...running]);throw failed?failure:error}
  finally{signal?.removeEventListener('abort',abort)}
  signal?.throwIfAborted();
  if(typeof navigator!=='undefined')await navigator.storage?.persist?.().catch(()=>false);
  signal?.throwIfAborted();
  await pointerCache.put('/game/release-pointer',Response.json({cacheName,version:release.version,authEpoch:release.authEpoch,hashes:Object.fromEntries(release.resources.map(r=>[r.url,r.sha256]))}));
  for(const name of await caches.keys())if(name.startsWith('nexora-game-resources-')&&name!==cacheName)await caches.delete(name);
}
