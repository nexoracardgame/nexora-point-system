import {randomBytes,scrypt as nodeScrypt,timingSafeEqual} from 'node:crypto';

const N=131072,r=8,p=1;
function derive(password:string,salt:Buffer){return new Promise<Buffer>((resolve,reject)=>nodeScrypt(password,salt,64,{N,r,p,maxmem:192*1024*1024},(error,key)=>error?reject(error):resolve(key)))}
export function normalizeGameUsername(value:unknown){return typeof value==='string'?value.trim().toLowerCase():''}
export function validGameUsername(value:string){return /^[a-z0-9][a-z0-9_-]{2,23}$/.test(value)}
export function validGamePassword(value:unknown):value is string{return typeof value==='string'&&value.length>=12&&value.length<=128}
export async function hashGamePassword(password:string){
 if(!validGamePassword(password))throw Error('Invalid password length');
 const salt=randomBytes(24),key=await derive(password,salt);
 return `scrypt$${N}$${r}$${p}$${salt.toString('hex')}$${key.toString('hex')}`;
}
export async function verifyGamePassword(password:string,encoded:string){
 const parts=encoded.split('$');
 if(parts.length!==6||parts[0]!=='scrypt'||Number(parts[1])!==N||Number(parts[2])!==r||Number(parts[3])!==p||!/^[a-f0-9]{48}$/.test(parts[4])||!/^[a-f0-9]{128}$/.test(parts[5])||!validGamePassword(password))return false;
 const expected=Buffer.from(parts[5],'hex');if(expected.length!==64)return false;
 return timingSafeEqual(await derive(password,Buffer.from(parts[4],'hex')),expected);
}
