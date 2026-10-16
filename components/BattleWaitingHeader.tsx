"use client";
import BattleRoomActions from './BattleRoomActions';
import './BattleWaitingHeader.css';
type Props=React.ComponentProps<typeof BattleRoomActions>&{code:string};
export default function BattleWaitingHeader({code,...actions}:Props){
 return <header className="nexora-waiting-header"><div className="nexora-waiting-brand"><img src="/images/triad/nexora-official-logo.webp" alt="NEXORA CARD GAME" width={180} height={72}/><span aria-hidden="true">/</span><strong>{code}</strong></div><BattleRoomActions {...actions}/></header>;
}
