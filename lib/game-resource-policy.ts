import policy from '@/public/game-resource-policy.json';

// The manifest owns assets, never route responses or player uploads.
export function isGameResourceUrl(value:string){
 if(!value.startsWith('/')||value.startsWith('//')||/[?#\\\u0000-\u0020]/.test(value))return false;
 let decoded:string;
 try{decoded=decodeURIComponent(value)}catch{return false}
 if(decoded.startsWith('//')||/[?#\\\u0000-\u0020]/.test(decoded))return false;
 if(policy.liveFiles.includes(decoded.slice(1)))return false;
 if(decoded.includes('\\')||decoded.split('/').some(part=>part==='..'||part==='.'||part.startsWith('.')))return false;
 if(policy.livePrefixes.some(prefix=>decoded==='/'+prefix||decoded.startsWith('/'+prefix+'/')))return false;
 if(policy.assetRoots.some(root=>decoded.startsWith('/'+root+'/')))return true;
 return policy.extraFiles.includes(decoded.slice(1))||/\.[a-zA-Z0-9]{1,16}$/.test(decoded);
}
