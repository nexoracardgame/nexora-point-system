import art from '@/public/cards/card-art.json';

const catalog=art as Record<string,string>;
export const gameCardThumbnail=(cardNo:string)=>catalog[cardNo];
let preparation:Promise<void>|undefined;
const decoded=new Map<string,HTMLImageElement>();

// Small immutable thumbnails are shared by web, installed PWA, and desktop.
export function prepareCardAlbum():Promise<void>{
 if(typeof window==='undefined')return Promise.resolve();
 preparation??=(async()=>{
  const cache=await caches.open('nexora-card-art-v1');
  const urls=Object.values(catalog);let cursor=0;
  await Promise.all(Array.from({length:4},async()=>{while(cursor<urls.length){const url=urls[cursor++];if(await cache.match(url))continue;const response=await fetch(url);if(!response.ok)throw Error('Card artwork unavailable: '+url);await cache.put(url,response)}}));
  // Keep only the first viewport decoded, not hundreds of full-size textures.
  await Promise.all(urls.slice(0,24).map(url=>new Promise<void>((resolve,reject)=>{const image=new Image();decoded.set(url,image);image.onload=()=>{void image.decode().then(resolve,reject)};image.onerror=()=>{decoded.delete(url);reject(Error('Card artwork unavailable: '+url))};image.src=url})));
 })().catch(error=>{preparation=undefined;throw error});
 return preparation;
}
