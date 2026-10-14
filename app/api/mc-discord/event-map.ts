import sharp from 'sharp';
import { createHash } from 'crypto';
import assets from './map-assets.json';

type Pin={x:number;y:number;icon?:string};
const cache=new Map<string,Buffer>();
export async function renderEventMap(value:unknown):Promise<Buffer>{
  const pins=(Array.isArray(value)?value:value?[value]:[]) as Pin[];
  if(pins.length>40||pins.some(p=>!p||typeof p.x!=='number'||typeof p.y!=='number'||!Number.isFinite(p.x)||!Number.isFinite(p.y)||p.x<0||p.x>1||p.y<0||p.y>1||p.icon&&p.icon!=='pin'&&!Object.hasOwn(assets.icons,p.icon)))throw new Error('Invalid map pins');
  const key=createHash('sha256').update(JSON.stringify(pins)).digest('hex');
  const cached=cache.get(key);if(cached)return cached;
  // Match the wide satellite overview, keeping the entire island and every saved pin visible.
  const width=1600,height=1000,size=960,left=(width-size)/2,top=(height-size)/2;
  const layers:sharp.OverlayOptions[]=[{input:await sharp(Buffer.from(assets.map,'base64')).resize(size,size).toBuffer(),left,top}];
  for(const p of pins){
    const source=p.icon&&Object.hasOwn(assets.icons,p.icon)?assets.icons[p.icon as keyof typeof assets.icons]:null;
    const input=source?await sharp(Buffer.from(source.split(',')[1],'base64')).resize(64,64,{fit:'contain',background:'#00000000'}).png().toBuffer():Buffer.from('<svg width="32" height="40"><path d="M16 38L5 21A14 14 0 1 1 27 21Z" fill="#bd68ff" stroke="white" stroke-width="3"/><circle cx="16" cy="14" r="5" fill="white"/></svg>');
    const w=source?64:32,h=source?64:40;
    layers.push({input,left:Math.max(0,Math.min(width-w,Math.round(left+p.x*size-w/2))),top:Math.max(0,Math.min(height-h,Math.round(top+p.y*size-h+8)))});
  }
  const buffer=await sharp({create:{width,height,channels:3,background:'#143c6a'}}).composite(layers).png().toBuffer();
  if(cache.size>=8)cache.delete(cache.keys().next().value!);cache.set(key,buffer);return buffer;
}
