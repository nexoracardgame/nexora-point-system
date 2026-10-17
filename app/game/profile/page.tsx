import {getServerSession} from 'next-auth';
import {redirect,notFound} from 'next/navigation';
import {authOptions} from '@/lib/auth';
import {readGameProfileDetails} from '@/lib/game-profile-details';
import GamePlayerProfile from '@/components/GamePlayerProfile';

export default async function GameProfilePage(){
 const session=await getServerSession(authOptions);
 if(!session?.user?.id)redirect('/game/login?callbackUrl=%2Fgame%2Fprofile');
 const details=await readGameProfileDetails(session.user.id);
 if(!details?.user)notFound();
 return <GamePlayerProfile user={details.user} initial={details.appearance} stats={details.stats} rank={details.rank} available={details.available}/>;
}
