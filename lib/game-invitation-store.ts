import {randomUUID} from 'node:crypto';
import {prisma} from './prisma';
import {getFriendRelation} from './friend-store';
import {findActiveGameRoom} from './active-game-room';

export type InvitationMode='triad'|'pentad'|'heptad';
export type GameInvitation={id:string;fromId:string;toId:string;senderName:string;senderImage:string;mode:InvitationMode;code:string;roomCreatedAt:number;status:string;createdAt:number;expiresAt:number};
type Person={id:string;name:string;image:string};
type RoomState={code:string;createdAt:Date|string|number;status?:string;game?:{forfeit?:{loser:Person}};seats:Record<'host'|'challenger',Person|null>;spectators:Person[];data?:Record<string,any>};
type Db=Pick<typeof prisma,'$queryRawUnsafe'|'$executeRawUnsafe'>;
let schema:Promise<unknown>|undefined;
async function ensureSchema(){
  schema??=prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "GameInvitation" ("id" TEXT PRIMARY KEY,"fromId" TEXT NOT NULL,"toId" TEXT NOT NULL,"senderName" TEXT NOT NULL,"senderImage" TEXT NOT NULL,"mode" TEXT NOT NULL,"code" TEXT NOT NULL,"roomCreatedAt" DOUBLE PRECISION NOT NULL,"status" TEXT NOT NULL DEFAULT 'pending',"createdAt" DOUBLE PRECISION NOT NULL,"expiresAt" DOUBLE PRECISION NOT NULL,UNIQUE("fromId","toId","mode","code","roomCreatedAt"))`).catch(error=>{schema=undefined;throw error});
  await schema;
}
const table={triad:'TriadRoom',pentad:'PentadRoom',heptad:'HeptadRoom'};
function epoch(value:Date|string|number){return typeof value==='number'?value:new Date(value).getTime();}
async function readRoom(db:Db,mode:InvitationMode,code:string,lock=false){
  const rows=await db.$queryRawUnsafe<RoomState[]>(`SELECT * FROM "${table[mode]}" WHERE "code"=$1${lock?' FOR UPDATE':''}`,code);
  const row=rows[0];if(!row)throw Error('ห้องถูกปิดแล้ว');
  const data=row.data,lobby=mode==='heptad'?data?.lobby:data;
  const seats=lobby?.seats||row.seats,spectators=lobby?.spectators||row.spectators;
  const phase=data?.phase||row.status,createdAt=epoch(data?.createdAt||row.createdAt);
  return {row,data,lobby,seats:seats as RoomState['seats'],spectators:spectators as Person[],phase,createdAt};
}
function hasMember(room:Awaited<ReturnType<typeof readRoom>>,id:string){return Object.values(room.seats).some(p=>p?.id===id)||room.spectators.some(p=>p.id===id);}
export async function listGameInvitations(userId:string,mode?:InvitationMode,code?:string){
  await ensureSchema();const now=Date.now();
  if(mode&&code){const room=await readRoom(prisma,mode,code);if(!hasMember(room,userId))throw Error('คุณไม่ได้อยู่ในห้องนี้');return prisma.$queryRawUnsafe<GameInvitation[]>(`SELECT * FROM "GameInvitation" WHERE "fromId"=$1 AND "mode"=$2 AND "code"=$3 AND "roomCreatedAt"=$4 ORDER BY "createdAt" DESC`,userId,mode,code,room.createdAt);}
  return prisma.$queryRawUnsafe<GameInvitation[]>(`SELECT * FROM "GameInvitation" WHERE "toId"=$1 AND "status"='pending' AND "expiresAt">$2 ORDER BY "createdAt" DESC LIMIT 10`,userId,now);
}
export async function createGameInvitation(actor:Person,toId:string,mode:InvitationMode,code:string){
  if(actor.id===toId||(await getFriendRelation(actor.id,toId)).status!=='friends')throw Error('เชิญได้เฉพาะเพื่อนของคุณเท่านั้น');
  await ensureSchema();const room=await readRoom(prisma,mode,code);
  if(!hasMember(room,actor.id))throw Error('คุณไม่ได้อยู่ในห้องนี้');
  if(room.phase!=='waiting')throw Error('เชิญเพื่อนได้ในหน้ารอสนาม');
  if(hasMember(room,toId))throw Error('เพื่อนอยู่ในห้องแล้ว');
  const now=Date.now(),id=randomUUID();
  await prisma.$executeRawUnsafe(`INSERT INTO "GameInvitation" ("id","fromId","toId","senderName","senderImage","mode","code","roomCreatedAt","createdAt","expiresAt") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT ("fromId","toId","mode","code","roomCreatedAt") DO NOTHING`,id,actor.id,toId,actor.name,actor.image,mode,code,room.createdAt,now,now+120000);
  return (await listGameInvitations(actor.id,mode,code)).find(item=>item.toId===toId&&item.roomCreatedAt===room.createdAt)!;
}
export async function respondGameInvitation(actor:Person,id:string,accept:boolean){
  await ensureSchema();
  // Friendship resolution can read aliases; finish it before holding a DB connection.
  if(accept){const rows=await prisma.$queryRawUnsafe<GameInvitation[]>(`SELECT * FROM "GameInvitation" WHERE "id"=$1`,id);const invite=rows[0];if(!invite||invite.toId!==actor.id)throw Error('ไม่พบคำเชิญ');if(invite.status==='pending'&&(await getFriendRelation(invite.fromId,actor.id)).status!=='friends')throw Error('คำเชิญนี้ไม่สามารถใช้งานได้แล้ว');}
  return prisma.$transaction(async tx=>{
    await tx.$queryRawUnsafe(`SELECT pg_advisory_xact_lock(hashtext($1))`,actor.id);
    const rows=await tx.$queryRawUnsafe<GameInvitation[]>(`SELECT * FROM "GameInvitation" WHERE "id"=$1 FOR UPDATE`,id);
    const invite=rows[0];if(!invite||invite.toId!==actor.id)throw Error('ไม่พบคำเชิญ');
    if(invite.status==='accepted'&&accept)return {mode:invite.mode,code:invite.code};
    if(invite.status!=='pending'||invite.expiresAt<=Date.now())throw Error('คำเชิญนี้สิ้นสุดแล้ว');
    if(!accept){await tx.$executeRawUnsafe(`UPDATE "GameInvitation" SET "status"='declined' WHERE "id"=$1`,id);return null;}
    const active=await findActiveGameRoom(actor.id,tx);
    if(active&&(active.mode!==invite.mode||active.code!==invite.code))throw Error('กรุณาออกจากห้องปัจจุบันก่อนรับคำเชิญ');
    const room=await readRoom(tx,invite.mode,invite.code,true);
    if(room.createdAt!==invite.roomCreatedAt||!hasMember(room,invite.fromId)||room.phase==='finished')throw Error('ห้องหรือคำเชิญนี้สิ้นสุดแล้ว');
    const forfeit=invite.mode==='triad'?room.row.game?.forfeit:room.lobby?.forfeit;
    if(forfeit?.loser.id===actor.id)throw Error('ออกจากการแข่งขันนี้แล้ว ไม่สามารถกลับเข้าได้');
    if(!hasMember(room,actor.id)){
      const empty=room.phase==='waiting'?(['host','challenger'] as const).find(side=>!room.seats[side]):undefined;
      const participant={...actor,joinedAt:Date.now()};
      if(empty)room.seats[empty]=participant;
      else{if(room.spectators.length>=10)throw Error('ช่องผู้ชมเต็มแล้ว');room.spectators.push(participant);}
      if(invite.mode==='triad'){
        await tx.$executeRawUnsafe(`UPDATE "TriadRoom" SET "seats"=$2::jsonb,"spectators"=$3::jsonb,"updatedAt"=NOW() WHERE "code"=$1`,invite.code,JSON.stringify(room.seats),JSON.stringify(room.spectators));
      }else{
        room.data!.version++;room.data!.updatedAt=Date.now();
        await tx.$executeRawUnsafe(`UPDATE "${table[invite.mode]}" SET "data"=$2::jsonb,"updatedAt"=NOW() WHERE "code"=$1`,invite.code,JSON.stringify(room.data));
      }
    }
    await tx.$executeRawUnsafe(`UPDATE "GameInvitation" SET "status"='accepted' WHERE "id"=$1`,id);
    return {mode:invite.mode,code:invite.code};
  },{timeout:15000});
}
