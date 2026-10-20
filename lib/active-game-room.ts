import {prisma} from './prisma';
export type ActiveGameRoom={mode:'triad'|'pentad'|'heptad';code:string};
type Row={code:string;updatedAt:Date|string};
async function optionalTable<T>(query:Promise<T[]>):Promise<T[]>{try{return await query}catch(e){const error=e as {code?:string;meta?:{code?:string}};if(error.code==='42P01'||error.meta?.code==='42P01')return [];throw e}}
export async function findActiveGameRoom(userId:string):Promise<ActiveGameRoom|null>{
 const [triad,pentad,heptad]=await Promise.all([
  optionalTable(prisma.$queryRawUnsafe<Row[]>(`SELECT "code","updatedAt" FROM "TriadRoom" WHERE ("seats"->'host'->>'id'=$1 OR "seats"->'challenger'->>'id'=$1) AND "status" IN ('waiting','playing') AND COALESCE("game"->>'matchWinner','')='' ORDER BY "updatedAt" DESC LIMIT 1`,userId)),
  optionalTable(prisma.$queryRawUnsafe<Row[]>(`SELECT "code","updatedAt" FROM "PentadRoom" WHERE ("data"->'seats'->'host'->>'id'=$1 OR "data"->'seats'->'challenger'->>'id'=$1) AND "data"->>'phase'<>'finished' ORDER BY "updatedAt" DESC LIMIT 1`,userId)),
  optionalTable(prisma.$queryRawUnsafe<Row[]>(`SELECT "code","updatedAt" FROM "HeptadRoom" WHERE ("data"->'lobby'->'seats'->'host'->>'id'=$1 OR "data"->'lobby'->'seats'->'challenger'->>'id'=$1) AND "data"->>'phase'<>'finished' ORDER BY "updatedAt" DESC LIMIT 1`,userId))
 ]);
 const latest=[...triad.map(r=>({...r,mode:'triad' as const})),...pentad.map(r=>({...r,mode:'pentad' as const})),...heptad.map(r=>({...r,mode:'heptad' as const}))].sort((a,b)=>new Date(b.updatedAt).getTime()-new Date(a.updatedAt).getTime())[0];
 return latest?{code:latest.code,mode:latest.mode}:null;
}
