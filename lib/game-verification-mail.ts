export function gameMailReady(){return Boolean(process.env.RESEND_API_KEY&&process.env.GAME_MAIL_FROM&&process.env.GAME_PUBLIC_ORIGIN)}
export async function sendGameVerificationEmail(email:string,token:string){
 if(!gameMailReady())throw Error('MAIL_NOT_CONFIGURED');
 const origin=new URL(process.env.GAME_PUBLIC_ORIGIN!);if(origin.protocol!=='https:')throw Error('MAIL_NOT_CONFIGURED');
 const link=new URL('/game/verify-email',origin);link.searchParams.set('token',token);
 const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,'Content-Type':'application/json','Idempotency-Key':`game-verify-${token}`},body:JSON.stringify({from:process.env.GAME_MAIL_FROM,to:[email],subject:'ยืนยันอีเมลบัญชี NEXORA',text:`ยืนยันอีเมลบัญชี NEXORA ของคุณ\n\n${link.href}\n\nลิงก์มีอายุ 30 นาที และใช้ได้ครั้งเดียว หากคุณไม่ได้สมัคร สามารถละเว้นอีเมลนี้ได้`,html:`<div style="background:#090f10;color:#f5ebd5;padding:36px;font-family:Arial,sans-serif"><h1 style="color:#efce84">NEXORA</h1><h2>ยืนยันอีเมลบัญชีของคุณ</h2><p>กดปุ่มด้านล่างเพื่อยืนยันอีเมลและเปิดใช้งานบัญชี</p><p style="padding:20px 0"><a href="${link.href}" style="background:#efce84;color:#111;padding:14px 24px;text-decoration:none">ยืนยันอีเมล</a></p><p>ลิงก์มีอายุ 30 นาที และใช้ได้ครั้งเดียว</p><p>หากคุณไม่ได้สมัคร สามารถละเว้นอีเมลนี้ได้</p></div>`}),signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw Error('MAIL_SEND_FAILED');
 const result=await response.json();if(typeof result.id!=='string')throw Error('MAIL_SEND_FAILED');
}
