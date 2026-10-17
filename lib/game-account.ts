import {prisma} from '@/lib/prisma';
export const NAME_CHANGE_INTERVAL=7*24*60*60*1000;
let schema:Promise<unknown>|undefined;
export function ensureGameAccount(){return schema??=prisma.$executeRawUnsafe('CREATE TABLE IF NOT EXISTS "GameAccountSettings" ("userId" TEXT PRIMARY KEY REFERENCES "User"("id") ON DELETE CASCADE,"nameChangedAt" TIMESTAMPTZ)').catch(error=>{schema=undefined;throw error})}
export function nextNameChange(at:Date|null){return at?new Date(at.getTime()+NAME_CHANGE_INTERVAL).toISOString():null}
export function validGameName(name:unknown):name is string{return typeof name==='string'&&name.trim().length>=2&&name.trim().length<=32&&!/[\u0000-\u001f\u007f]/.test(name)}
