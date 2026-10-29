import {prisma} from './prisma';
export type ActiveGameRoom={mode:'triad'|'pentad'|'heptad';code:string};
type Row={code:string;updatedAt:Date|string};
async function optionalTable<T>(query:Promise<T[]>):Promise<T[]>{try{return await query}catch(e){const error=e as {code?:string;meta?:{code?:string}};if(error.code==='42P01'||error.meta?.code==='42P01')return [];throw e}}
export async function findActiveGameRoom(userId:string,transaction?:Pick<typeof prisma,'$queryRawUnsafe'>):Promise<ActiveGameRoom|null>{
 const db=transaction||prisma;
 const available=transaction?new Set((await db.$queryRawUnsafe<{name:string}[]>(`SELECT tablename AS name FROM pg_tables WHERE schemaname='public' AND tablename IN ('TriadRoom','PentadRoom','HeptadRoom')`)).map(row=>row.name)):null;
 const query=(table:string,sql:string)=>available&&!available.has(table)?Promise.resolve([] as Row[]):optionalTable(db.$queryRawUnsafe<Row[]>(sql,userId));
 const [triad,pentad,heptad]=await Promise.all([
  query('TriadRoom',`SELECT "code","updatedAt" FROM "TriadRoom" WHERE ("seats"->'host'->>'id'=$1 OR "seats"->'challenger'->>'id'=$1) AND "status" IN ('waiting','playing') AND COALESCE("game"->>'matchWinner','')='' ORDER BY "updatedAt" DESC LIMIT 1`),
  query('PentadRoom',`SELECT "code","updatedAt" FROM "PentadRoom" WHERE ("data"->'seats'->'host'->>'id'=$1 OR "data"->'seats'->'challenger'->>'id'=$1) AND "data"->>'phase'<>'finished' ORDER BY "updatedAt" DESC LIMIT 1`),
  query('HeptadRoom',`SELECT "code","updatedAt" FROM "HeptadRoom" WHERE ("data"->'lobby'->'seats'->'host'->>'id'=$1 OR "data"->'lobby'->'seats'->'challenger'->>'id'=$1) AND "data"->>'phase'<>'finished' ORDER BY "updatedAt" DESC LIMIT 1`)
 ]);
 const latest=[...triad.map(r=>({...r,mode:'triad' as const})),...pentad.map(r=>({...r,mode:'pentad' as const})),...heptad.map(r=>({...r,mode:'heptad' as const}))].sort((a,b)=>new Date(b.updatedAt).getTime()-new Date(a.updatedAt).getTime())[0];
 return latest?{code:latest.code,mode:latest.mode}:null;
}
