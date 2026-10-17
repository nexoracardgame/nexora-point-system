"use client";
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {MailCheck,ShieldCheck} from 'lucide-react';
import './GameEmailVerification.css';
export default function GameEmailVerification(){
 const [token,setToken]=useState(''),[status,setStatus]=useState<'ready'|'busy'|'done'>('ready'),[error,setError]=useState('');
 useEffect(()=>{setToken(new URLSearchParams(window.location.search).get('token')||'');window.history.replaceState(null,'',window.location.pathname)},[]);
 const verify=async()=>{if(status==='busy')return;setStatus('busy');setError('');try{const response=await fetch('/api/game-account/verify-email',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token})});const result=await response.json();if(!response.ok)throw Error(result.error);setStatus('done');setToken('')}catch(e){setError(e instanceof Error?e.message:'ยืนยันไม่สำเร็จ');setStatus('ready')}};
 return <section className="nx-email-verification"><div><MailCheck size={44}/><span className="nx-site-eyebrow">NEXORA ACCOUNT</span><h1>{status==='done'?'ยืนยันอีเมลแล้ว':'ยืนยันอีเมลของคุณ'}</h1><p>{status==='done'?'บัญชีของคุณพร้อมใช้งานแล้ว เข้าสู่ระบบด้วย Username และ Password ที่สมัครไว้':'กดยืนยันเพื่อเปิดใช้งานบัญชี NEXORA ของคุณ'}</p>{error&&<p role="alert">{error}</p>}{status==='done'?<Link className="nx-site-primary" href="/game/login?callbackUrl=%2Fgame">เข้าสู่ระบบ</Link>:<button className="nx-site-primary" disabled={!token||status==='busy'} onClick={()=>void verify()}><ShieldCheck size={20}/>{status==='busy'?'กำลังยืนยัน':'ยืนยันอีเมล'}</button>}<Link href="/game/login">กลับหน้าเข้าสู่ระบบ</Link></div></section>;
}
