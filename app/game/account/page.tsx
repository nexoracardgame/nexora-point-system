import {getServerSession} from 'next-auth';
import {redirect} from 'next/navigation';
import {authOptions} from '@/lib/auth';
import GameAccountEditor from '@/components/GameAccountEditor';
export default async function GameAccountPage(){const session=await getServerSession(authOptions);if(!session?.user?.id)redirect('/game/login?callbackUrl=%2Fgame%2Faccount');return <GameAccountEditor/>}
