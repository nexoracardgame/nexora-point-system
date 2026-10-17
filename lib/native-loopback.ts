export function nativeLoopbackTarget(raw:string|null){
 try{const url=new URL(raw||'');if(url.protocol!=='http:'||url.hostname!=='127.0.0.1'||!url.port||Number(url.port)<1024||url.username||url.password||url.search||url.hash||!/^\/nexora-auth\/[a-f0-9]{64}$/.test(url.pathname))return null;return url.href}catch{return null}
}
