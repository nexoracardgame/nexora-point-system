import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import HeptadClient from './HeptadClient';

export default async function HeptadPage({searchParams}:{searchParams:Promise<{room?:string;spectate?:string}>}){
  const query=await searchParams,session=await getServerSession(authOptions);
  const params=new URLSearchParams();if(query.room)params.set('room',query.room);if(query.spectate)params.set('spectate',query.spectate);
  if(!session?.user?.id)redirect(`/game/login?callbackUrl=${encodeURIComponent(`/game/heptad?${params}`)}`);
  return <HeptadClient key={query.room||'lobby'} userId={String(session.user.id)} initialCode={query.room||''} spectate={query.spectate==='1'}/>;
}
