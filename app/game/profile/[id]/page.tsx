import {getServerSession} from 'next-auth';
import {redirect,notFound} from 'next/navigation';
import {authOptions} from '@/lib/auth';
import {readGameProfileDetails} from '@/lib/game-profile-details';
import GamePlayerProfile from '@/components/GamePlayerProfile';

export default async function PlayerGameProfile({params}:{params:Promise<{id:string}>}){
 const {id}=await params,session=await getServerSession(authOptions);
 if(!session?.user?.id)redirect('/game/login?callbackUrl='+encodeURIComponent('/game/profile/'+encodeURIComponent(id)));
 if(id===session.user.id)redirect('/game/profile');
 if(id.length>200)notFound();
 const details=await readGameProfileDetails(id);
 if(!details?.user)notFound();
 return <GamePlayerProfile user={details.user} initial={details.appearance} stats={details.stats} rank={details.rank} available={details.available} readOnly/>;
}
