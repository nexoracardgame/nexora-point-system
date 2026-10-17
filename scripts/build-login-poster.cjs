const fs=require('node:fs');
const http=require('node:http');
const {chromium}=require('C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const root='public/videos/nexora-login-4k/';
 const manifest=JSON.parse(fs.readFileSync(root+'manifest.json','utf8'));
 const bytes=Buffer.concat(manifest.parts.map(part=>fs.readFileSync(root+part)));
 const server=http.createServer((request,response)=>{
  if(request.url!=='/video.mp4'){response.setHeader('Content-Type','text/html');response.end('<video src="/video.mp4" muted preload="auto"></video>');return}
  const range=request.headers.range?.match(/^bytes=(\d+)-(\d*)$/);
  if(range){const start=Number(range[1]),end=range[2]?Number(range[2]):bytes.length-1;response.writeHead(206,{'Content-Type':'video/mp4','Accept-Ranges':'bytes','Content-Range':`bytes ${start}-${end}/${bytes.length}`,'Content-Length':end-start+1});response.end(bytes.subarray(start,end+1))}
  else{response.writeHead(200,{'Content-Type':'video/mp4','Content-Length':bytes.length,'Accept-Ranges':'bytes'});response.end(bytes)}
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const page=await browser.newPage();
  await page.goto(`http://127.0.0.1:${server.address().port}/`,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.querySelector('video').readyState>=2);
  const data=await page.evaluate(()=>{const video=document.querySelector('video'),canvas=document.createElement('canvas');canvas.width=1920;canvas.height=1080;canvas.getContext('2d').drawImage(video,0,0,1920,1080);return canvas.toDataURL('image/webp',.88).split(',')[1]});
  fs.mkdirSync('public/game-assets/login',{recursive:true});fs.writeFileSync('public/game-assets/login/website-poster.webp',Buffer.from(data,'base64'));
  console.log('Generated website poster from original login scene');
 }finally{await browser.close();server.closeAllConnections();server.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
