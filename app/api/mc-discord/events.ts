import { createHash } from 'crypto';
import { renderEventMap } from './event-map';

const API = 'https://discord.com/api/v10';
const CHANNEL = '1525556475995357264';
const WEB = 'https://script.google.com/macros/s/AKfycbwyDfe498KkEUhD_W8ddE_yEJScbESaR9hxtHwGx121sTv4vpgY61uMMWu_6_-7iSsCmg/exec';
type Event = {id:string;title:string;description:string;location:string;startsAt:string;deadline:string;status:string;mapPin?:unknown};
const clean = (value: string) => value.replace(/[\\*_~`>|]/g, '\\$&').replace(/@/g, '@\u200b');

export function eventMessage(event: Event, emojis: Record<string,string>) {
  const cancelled=event.status==='cancelled', start=Math.floor(Date.parse(event.startsAt)/1000), deadline=Math.floor(Date.parse(event.deadline)/1000);
  const title=emojis['1506940284205010964']||'✦', flame=emojis['1200056999052857354']||'✧', arrow=emojis['1495409128745734144']||'›';
  return {
    allowed_mentions:{parse:[]},
    embeds:[{color:cancelled?0x777777:0xac65ed,title:'THE MC CLUB | '+(cancelled?'EVENT CANCELLED':'UPCOMING EVENT'),
      description:`${title} **${clean(event.title)}**\n\n${clean(event.description)}`,
      fields:[{name:`${flame} WHEN · วันเวลา`,value:`<t:${start}:F> · <t:${start}:R>`,inline:false},
        {name:'LOCATION · สถานที่',value:clean(event.location),inline:true},
        {name:'RSVP · ปิดรับคำตอบ',value:`<t:${deadline}:F>`,inline:true},
        {name:`${arrow} YOUR RESPONSE · ตอบรับกิจกรรม`,value:cancelled?'กิจกรรมนี้ถูกยกเลิกแล้ว':'เข้าร่วม / ขอดูอีกที / ไม่ว่าง\nเข้าสู่ระบบ MEMBER ROSTER เพื่อเลือกคำตอบและดูรายชื่อ เปลี่ยนคำตอบได้ก่อนปิดรับ',inline:false}],
      footer:{text:`MC EVENT · ${event.id}`}}],
    components:[{type:1,components:[{type:2,style:5,label:'MEMBER ROSTER · เปิดกิจกรรม',url:WEB}]}],
  };
}

export async function sendEventNotification(body:Record<string,unknown>, token:string, emojis:Record<string,string>) {
  const event=body.event as Event, target=String(body.target||'');
  const batch=String(body.batchId||'');
  if(batch&&!/^[a-f0-9-]{32,36}$/.test(batch))return {ok:false,message:'Invalid delivery batch'};
  if(!event||!/^[a-f0-9-]{32,36}$/.test(event.id)||!['open','cancelled'].includes(event.status)||
    !event.title||typeof event.title!=='string'||event.title.length>100||typeof event.description!=='string'||event.description.length>1800||
    !event.location||typeof event.location!=='string'||event.location.length>150||!Number.isFinite(Date.parse(event.startsAt))||!Number.isFinite(Date.parse(event.deadline))||
    (target!=='channel'&&!/^\d{17,20}$/.test(target))) return {ok:false,message:'Invalid event notification'};
  const call=async(path:string,method='GET',payload?:unknown)=>{
    const multipart=payload instanceof FormData;
    const response=await fetch(API+path,{method,headers:{Authorization:`Bot ${token}`,...(!multipart?{'Content-Type':'application/json'}:{})},...(payload?{body:multipart?payload:JSON.stringify(payload)}:{}),cache:'no-store',signal:AbortSignal.timeout(15000)});
    const data=await response.json();
    if(!response.ok) throw Object.assign(new Error(response.status===403?'Discord ไม่อนุญาตให้ส่งข้อความ หรือสมาชิกปิด DM':`Discord HTTP ${response.status}`),{status:response.status,retryAfter:Number(data.retry_after)||0});
    return data;
  };
  try {
    const channel=target==='channel'?CHANNEL:String((await call('/users/@me/channels','POST',{recipient_id:target})).id);
    if(!/^\d{17,20}$/.test(channel))throw new Error('Invalid Discord channel');
    const payload=eventMessage(event,emojis);
    const footer=`MC EVENT · ${event.id}`+(batch?` · ${batch}`:'');
    payload.embeds[0].footer.text=footer;
    const nonce=createHash('sha256').update(`${event.id}:${target}:${batch}`).digest('hex').slice(0,24);
    const announce=async()=>{
      if(target!=='channel'||event.status==='cancelled')return;
      // A separate final line puts the actual ping below the embed and attached map.
      if(body.retry===true){const history=await call(`/channels/${channel}/messages?limit=100`);if(history.some((m:{nonce?:string})=>String(m.nonce)===nonce+'e'))return;}
      await call(`/channels/${channel}/messages`,'POST',{content:'@everyone',allowed_mentions:{parse:['everyone']},nonce:nonce+'e',enforce_nonce:true});
    };
    let existing=target==='channel'&&/^\d{17,20}$/.test(String(body.messageId||''))?String(body.messageId):'';
    // Recover a successful send whose response was lost, before retrying the outbox.
    if(!existing&&(body.retry===true||event.status==='cancelled')){
      const history=await call(`/channels/${channel}/messages?limit=100`);
      const found=history.find((m:{embeds?:Array<{footer?:{text?:string}}>;author?:{id:string}})=>m.author?.id==='1544896499241062541'&&m.embeds?.some(e=>e.footer?.text===footer));
      if(found)existing=found.id;
    }
    if(existing){
      if(target==='channel'&&event.status==='cancelled') await call(`/channels/${channel}/messages/${existing}`,'PATCH',payload);
      await announce();return {ok:true,messageId:existing};
    }
    const map=await renderEventMap(event.mapPin);
    const form=new FormData();
    form.append('payload_json',JSON.stringify({...payload,embeds:payload.embeds.map(e=>({...e,image:{url:'attachment://mc-activity-map.png'}})),attachments:[{id:0,filename:'mc-activity-map.png'}],nonce,enforce_nonce:true}));
    form.append('files[0]',new Blob([new Uint8Array(map)],{type:'image/png'}),'mc-activity-map.png');
    const message=await call(`/channels/${channel}/messages`,'POST',form);
    await announce();
    return {ok:true,messageId:message.id};
  }catch(error){
    const err=error as Error&{status?:number;retryAfter?:number};
    return {ok:false,retryable:!err.status||err.status===429||err.status>=500,retryAfter:err.retryAfter||0,message:err.status?err.message:'Discord connection failed'};
  }
}
