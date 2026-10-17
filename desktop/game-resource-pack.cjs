const fs=require('node:fs/promises'),path=require('node:path'),{createHash}=require('node:crypto');

function createGameResourceHandler({root,origin,release,activeVersion,fetchNetwork}){
 const files=new Map(release.resources.map(file=>[file.url,file]));
 return async request=>{
  const url=new URL(request.url),resource=files.get(url.pathname);
  if(request.method==='GET'&&url.origin===origin&&url.pathname==='/game-release.json'){const response=await fetchNetwork(request);try{if(response.ok)activeVersion=(await response.clone().json()).version}catch{activeVersion=undefined}return response}
  // Normal URLs are local from first launch only for the current server release.
  const patch=url.searchParams.get('patch');
  if(patch&&patch!==release.version)activeVersion=undefined;
  if(request.method!=='GET'||url.origin!==origin||!resource||(patch?patch!==release.version:activeVersion!==release.version))return fetchNetwork(request);
  try{
   const file=path.resolve(root,'.'+decodeURIComponent(resource.url)),base=path.resolve(root)+path.sep;
   if(!file.startsWith(base))return fetchNetwork(request);
   const bytes=await fs.readFile(file);
   if(bytes.length!==resource.bytes||createHash('sha256').update(bytes).digest('hex')!==resource.sha256)return fetchNetwork(request);
   const types={'.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.mp3':'audio/mpeg','.mp4':'video/mp4','.woff2':'font/woff2','.json':'application/json'};
   return new Response(bytes,{headers:{'Content-Type':resource.mimeType||types[path.extname(file)]||'application/octet-stream','Content-Length':String(bytes.length),'X-Nexora-Resource':'installed-pack'}});
  }catch{return fetchNetwork(request)}
 };
}
async function registerGameResourcePack({session,root,appUrl}){
 const release=JSON.parse(await fs.readFile(path.join(root,'game-release.json'),'utf8'));
 const fetchNetwork=request=>session.fetch(request,{bypassCustomProtocolHandlers:true});
 let activeVersion;try{const response=await fetchNetwork(new Request(new URL('/game-release.json',appUrl),{signal:AbortSignal.timeout(10000)}));if(response.ok)activeVersion=(await response.json()).version}catch{}
 const handler=createGameResourceHandler({root,origin:new URL(appUrl).origin,release,activeVersion,fetchNetwork});
 session.protocol.handle('https',handler);
}
module.exports={createGameResourceHandler,registerGameResourcePack};
