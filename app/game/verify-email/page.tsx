import type {Metadata} from 'next';
import GameEmailVerification from '@/components/GameEmailVerification';
export const metadata:Metadata={title:{absolute:'ยืนยันอีเมล | NEXORA'},referrer:'no-referrer',robots:{index:false,follow:false}};
export default function VerifyEmailPage(){return <GameEmailVerification/>}
