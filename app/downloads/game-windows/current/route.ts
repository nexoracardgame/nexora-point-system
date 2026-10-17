import {NextResponse} from 'next/server';
import fs from 'node:fs/promises';
import path from 'node:path';
export async function GET(){
 let url='/downloads/game-windows/NEXORA-CARD-GAME-Setup-1.0.6.exe';
 try{const current=JSON.parse(await fs.readFile(path.join(process.cwd(),'public/downloads/game-windows/current.json'),'utf8'));const parsed=new URL(current.url);if(parsed.origin==='https://github.com'&&parsed.pathname.startsWith('/nexoracardgame/nexora-point-system/releases/download/game-v'))url=parsed.href}catch{}
 return NextResponse.redirect(new URL(url,'https://nexora-point-system.vercel.app'),{status:307,headers:{'Cache-Control':'no-store'}});
}
