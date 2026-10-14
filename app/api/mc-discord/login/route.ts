import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const POPUP_URL = "https://nexora-point-system.vercel.app/api/mc-discord/login";
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwyDfe498KkEUhD_W8ddE_yEJScbESaR9hxtHwGx121sTv4vpgY61uMMWu_6_-7iSsCmg/exec";
const STATE_PATTERN = /^login_[a-f0-9]{32}$/;
const COOKIE_PATH = "/api/mc-discord/login";
const headers = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff" };

type Binding = { state: string; pollToken: string; expiresAt: number };

function cookieKey(secret: string) {
  return createHash("sha256").update("mc-discord-popup-v1:" + secret).digest();
}

function seal(binding: Binding, secret: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", cookieKey(secret), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(binding), "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64url");
}

function readBinding(request: Request, state: string, secret: string): Binding | null {
  try {
    const name = "__Secure-mc-" + state + "=";
    const raw = (request.headers.get("cookie") || "").split(";").map(value => value.trim()).find(value => value.startsWith(name));
    if (!raw || raw.length > 1024) return null;
    const data = Buffer.from(raw.slice(name.length), "base64url");
    const decipher = createDecipheriv("aes-256-gcm", cookieKey(secret), data.subarray(0, 12));
    decipher.setAuthTag(data.subarray(12, 28));
    const binding = JSON.parse(Buffer.concat([decipher.update(data.subarray(28)), decipher.final()]).toString("utf8")) as Binding;
    return binding.state === state && /^[a-f0-9]{32}$/.test(binding.pollToken) && binding.expiresAt > Date.now() ? binding : null;
  } catch { return null; }
}

function cookie(state: string, value: string, maxAge: number) {
  return `__Secure-mc-${state}=${value}; Path=${COOKIE_PATH}; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`;
}

function html(script: string, message: string, extraHeaders: Record<string, string> = {}, callbackURL = "") {
  const nonce = randomBytes(16).toString("base64");
  return new Response(`<!doctype html><html lang="th"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>THE MC CLUB Discord Login</title>
    <style nonce="${nonce}">:root{color-scheme:dark}*{box-sizing:border-box}body{margin:0;min-height:100dvh;display:grid;place-items:center;background:#08060b;color:#fff;font:16px Arial,sans-serif}main{width:min(460px,calc(100% - 40px));padding:32px 24px;text-align:center;border:1px solid #9769c0;border-radius:8px;background:#000b;box-shadow:0 0 24px #8f4cbd33}h1{font-size:24px;color:#ecdcff;text-shadow:1px 0 #a970d8}p{line-height:1.6}button{padding:12px 24px;color:#fff;background:#251333;border:1px solid #a970d8;border-radius:6px;cursor:pointer}</style></head>
    <body><main><h1>DISCORD LOGIN</h1><p id="status" role="status">${message}</p><button id="close">กลับหน้าหลัก</button></main>${callbackURL ? `<iframe title="Discord callback" hidden src="${callbackURL.replace(/&/g, "&amp;")}"></iframe>` : ""}
    <script nonce="${nonce}">function closePopup(){try{if(window.opener)window.opener.focus();}catch(error){}window.close();}document.getElementById('close').onclick=closePopup;${script}</script></body></html>`, {
    headers: { ...headers, "Content-Type": "text/html; charset=utf-8", "Content-Security-Policy": `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}'; connect-src 'self'; frame-src https://script.google.com https://*.googleusercontent.com; base-uri 'none'; frame-ancestors 'none'; form-action 'none'`, ...extraHeaders },
  });
}

export async function POST(request: Request) {
  const secret = process.env.MC_DISCORD_PROXY_SECRET?.trim();
  if (!secret) return Response.json({ ok: false }, { status: 503, headers });
  if (request.headers.get("origin") !== new URL(request.url).origin || !request.headers.get("content-type")?.startsWith("application/json")) {
    return Response.json({ ok: false }, { status: 403, headers });
  }
  try {
    const body = await request.json();
    if (!STATE_PATTERN.test(body.state || "") || !/^[a-f0-9]{32}$/.test(body.pollToken || "")) throw new Error("Invalid binding");
    const auth = new URL(String(body.authorizationUrl || ""));
    if (auth.origin !== "https://discord.com" || auth.pathname !== "/oauth2/authorize" || auth.searchParams.get("redirect_uri") !== POPUP_URL || auth.searchParams.get("scope") !== "identify" || auth.searchParams.get("state") !== body.state || auth.searchParams.get("client_id") !== (process.env.DISCORD_CLIENT_ID?.trim() || "1544896499241062541")) throw new Error("Invalid authorization URL");
    const binding = { state: body.state, pollToken: body.pollToken, expiresAt: Date.now() + 300000 };
    return Response.json({ ok: true, url: auth.href }, { headers: { ...headers, "Set-Cookie": cookie(binding.state, seal(binding, secret), 300) } });
  } catch { return Response.json({ ok: false }, { status: 400, headers }); }
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const state = params.get("state") || "";
  if (!state && !params.has("code") && !params.has("error")) {
    // Bind in the top-level popup before Discord can sever its opener. No secrets travel in URLs.
    return html(String.raw`
      let started=false;const deadline=Date.now()+300000;
      const timer=setInterval(()=>{if(Date.now()>deadline){clearInterval(timer);document.getElementById('status').textContent='คำขอหมดอายุ กรุณากลับหน้าหลักแล้วลองใหม่';return;}try{if(window.opener)window.opener.postMessage({type:'mc-discord-login-ready'},'*');}catch(error){}},200);
      window.addEventListener('message',async event=>{
        if(started||event.source!==window.opener||!/^https:\/\/[a-z0-9-]+-script\.googleusercontent\.com$/.test(event.origin)||!event.data||event.data.type!=='mc-discord-login-start')return;
        started=true;clearInterval(timer);
        try{
          const response=await fetch(location.pathname,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(event.data),credentials:'same-origin'});
          const result=await response.json();if(!result.ok)throw new Error('Invalid request');location.replace(result.url);
        }catch(error){document.getElementById('status').textContent='เริ่มล็อกอินไม่สำเร็จ กรุณากลับหน้าหลักแล้วลองใหม่';}
      });`, "กำลังเปิด Discord เพื่อยืนยันตัวตน...");
  }
  const secret = process.env.MC_DISCORD_PROXY_SECRET?.trim();
  const binding = secret && STATE_PATTERN.test(state) ? readBinding(request, state, secret) : null;
  if (!binding || !secret) return html("", "คำขอหมดอายุหรือไม่ได้เริ่มจากหน้าหลัก กรุณากลับไปกด Discord ใหม่");
  const clearCookie = { "Set-Cookie": cookie(state, "", 0) };
  const callbackURL = new URL(SCRIPT_URL);
  callbackURL.search = new URLSearchParams({ state, code: (params.get("code") || "").slice(0, 512), error: (params.get("error") || "").slice(0, 128) }).toString();
  const clientBinding = JSON.stringify({state,token:binding.pollToken}).replace(/</g, "\\u003c");
  // The trusted Apps Script iframe exchanges the code; only this unsandboxed top-level page closes the tab.
  return html(String.raw`
    const binding=${clientBinding};
    window.addEventListener('message',event=>{
      if(!event.source||event.source.top!==window||!/^https:\/\/[a-z0-9-]+-script\.googleusercontent\.com$/.test(event.origin)||!event.data||event.data.state!==binding.state)return;
      if(event.data.type==='request')event.source.postMessage({type:'binding',state:binding.state,token:binding.token},event.origin);
      if(event.data.type==='complete'){document.getElementById('status').textContent='ยืนยันเรียบร้อยแล้ว กำลังกลับหน้าหลัก...';closePopup();setTimeout(closePopup,250);}
      if(event.data.type==='failed')document.getElementById('status').textContent='ยืนยันไม่สำเร็จ กรุณากลับหน้าหลักแล้วเริ่มล็อกอินใหม่';
    });`, "กำลังยืนยันตัวตน...", clearCookie, callbackURL.href);
}
