type Provider='google'|'line';
export async function nativeProviderStart(origin:string,provider:Provider,callbackUrl:string,incomingCookies:string){
 const csrf=await fetch(new URL('/api/auth/csrf',origin),{headers:{cookie:incomingCookies},cache:'no-store',redirect:'manual',signal:AbortSignal.timeout(10000)});
 if(!csrf.ok)throw Error('Native auth CSRF initialization failed');
 const data=await csrf.json();if(typeof data.csrfToken!=='string'||!data.csrfToken)throw Error('Missing native auth CSRF token');
 const csrfCookies=csrf.headers.getSetCookie();
 const jar=new Map<string,string>();
 for(const pair of [...incomingCookies.split(';'),...csrfCookies.map(value=>value.split(';',1)[0])]){const value=pair.trim(),equals=value.indexOf('=');if(equals>0)jar.set(value.slice(0,equals),value.slice(equals+1));}
 const cookies=[...jar].map(([name,value])=>`${name}=${value}`).join('; ');
 const signin=await fetch(new URL(`/api/auth/signin/${provider}`,origin),{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded',cookie:cookies},body:new URLSearchParams({csrfToken:data.csrfToken,callbackUrl,json:'true'}),cache:'no-store',redirect:'manual',signal:AbortSignal.timeout(10000)});
 if(!signin.ok&&signin.status!==302)throw Error('Native auth provider initialization failed');
 const location=signin.headers.get('location')||(await signin.json()).url;
 const destination=new URL(location);
 const providerHosts=provider==='google'?['accounts.google.com']:['access.line.me'];
 if(destination.protocol!=='https:'||!providerHosts.includes(destination.hostname))throw Error('Unexpected native auth provider destination');
 return {url:destination.toString(),cookies:[...csrfCookies,...signin.headers.getSetCookie()]};
}
