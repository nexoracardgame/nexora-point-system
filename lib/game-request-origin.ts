export function isTrustedGameOrigin(request:Request){
 const raw=request.headers.get('origin');
 if(!raw||raw==='null')return false;
 let origin:string;try{const url=new URL(raw);if(!['https:','http:'].includes(url.protocol)||url.origin!==raw)return false;origin=url.origin;}catch{return false;}
 const trusted=new Set([new URL(request.url).origin]);
 if(process.env.VERCEL_ENV==='production')trusted.add('https://nexora-point-system.vercel.app');
 // Only deployment-owned configuration may extend the allowlist, never forwarded headers.
 for(const value of [process.env.NEXTAUTH_URL,process.env.NEXT_PUBLIC_APP_URL,process.env.APP_URL,process.env.VERCEL_PROJECT_PRODUCTION_URL&&`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`,process.env.VERCEL_URL&&`https://${process.env.VERCEL_URL}`]){
  if(!value)continue;try{const url=new URL(value);if(['http:','https:'].includes(url.protocol))trusted.add(url.origin);}catch{}
 }
 return trusted.has(origin);
}
