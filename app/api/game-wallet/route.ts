import {getServerSession} from 'next-auth';
import {NextResponse} from 'next/server';
import {authOptions} from '@/lib/auth';
import {prisma} from '@/lib/prisma';
export async function GET(){
 const session=await getServerSession(authOptions);if(!session?.user?.id)return NextResponse.json({error:'Unauthorized'},{status:401});
 try{const wallet=await prisma.user.findUnique({where:{id:session.user.id},select:{coin:true,nexPoint:true}});if(!wallet)return NextResponse.json({error:'ไม่พบบัญชี'},{status:404});return NextResponse.json(wallet,{headers:{'Cache-Control':'no-store'}})}catch{return NextResponse.json({error:'โหลดยอดเงินไม่สำเร็จ'},{status:503})}
}
