import {NextResponse} from 'next/server';
import {getServerSession} from 'next-auth';
import {authOptions} from '@/lib/auth';
import {readGameProfileDetails} from '@/lib/game-profile-details';
export async function GET(request:Request){
 const session=await getServerSession(authOptions);if(!session?.user?.id)return NextResponse.json({error:'Unauthorized'},{status:401});
 const id=new URL(request.url).searchParams.get('id')||session.user.id;
 if(id.length>200)return NextResponse.json({error:'Invalid player'},{status:400});
 try{const details=await readGameProfileDetails(id);if(!details)return NextResponse.json({error:'Not found'},{status:404});return NextResponse.json(details,{headers:{'Cache-Control':'no-store'}})}catch{return NextResponse.json({error:'Profile unavailable'},{status:503})}
}
