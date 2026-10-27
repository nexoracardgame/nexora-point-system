const http=require('node:http'),{randomBytes,createHash}=require('node:crypto');
const {gameLoginCompleteHtml}=require('./game-login-complete.cjs');
async function startGameLogin({onToken,timeoutMs=180000}){
 const state=randomBytes(32).toString('hex'),verifier=randomBytes(32).toString('hex'),challenge=createHash('sha256').update(verifier).digest('hex');let used=false,timer;
 const server=http.createServer((req,res)=>{
  res.setHeader('Cache-Control','no-store');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('Content-Type','text/html; charset=utf-8');
  const url=new URL(req.url,'http://127.0.0.1');const token=url.searchParams.get('token');
  if(used||req.method!=='GET'||url.pathname!=='/nexora-auth/'+state||!token||token.length>8192){res.statusCode=400;res.end('Invalid login callback');return}
  used=true;clearTimeout(timer);server.close();
  let settled=false;
  const complete=success=>{if(settled)return;settled=true;clearTimeout(fallback);res.statusCode=success?200:502;res.end(gameLoginCompleteHtml(success));};
  const fallback=setTimeout(()=>complete(false),20000);fallback.unref();
  void Promise.resolve().then(()=>onToken(token,verifier)).then(()=>complete(true),()=>complete(false));
 });
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve)});
 timer=setTimeout(()=>server.close(),timeoutMs);timer.unref();
 return {redirect:`http://127.0.0.1:${server.address().port}/nexora-auth/${state}`,challenge,close:()=>{clearTimeout(timer);server.close()}};
}
module.exports={startGameLogin};
