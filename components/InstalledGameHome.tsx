"use client";
import {useEffect} from 'react';
import {useSession} from 'next-auth/react';
import {useRouter} from 'next/navigation';
import TriadDominionClient from '@/app/(main)/battle/triad-dominion/TriadDominionClient';
import {getTriadCatalogSummary,triadCards,triadSkillRules} from '@/lib/triad-dominion';

const summary=getTriadCatalogSummary();
const reviewSkills=triadSkillRules.filter(rule=>rule.needsReview).slice(0,18).map(rule=>({cardNo:rule.cardNo,name:rule.name,shape:rule.shape,text:rule.text,reviewReason:rule.reviewReason||''}));
export default function InstalledGameHome(){
 const {data:session,status}=useSession(),router=useRouter();
 useEffect(()=>{if(status==='unauthenticated')router.replace('/game/login?callbackUrl='+encodeURIComponent('/game'+window.location.search))},[status,router]);
 if(!session?.user?.id)return null;
 return <TriadDominionClient key={session.user.id} cards={triadCards} reviewSkills={reviewSkills} summary={summary} currentUser={{id:session.user.id,name:session.user.name||'PLAYER',image:session.user.image||'/avatar.png',role:session.user.role||'USER'}}/>;
}
