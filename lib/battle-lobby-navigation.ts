import {flushSync} from 'react-dom';

type Router={replace:(path:string)=>void};
export function commitBattleExit(release:()=>void){flushSync(release);}
// Inline room clients must release their parent before a same-route navigation.
export function returnToBattleLobby(router:Router,releaseInlineRoom?:()=>void){
 if(releaseInlineRoom){commitBattleExit(releaseInlineRoom);return;}
 const source=window.location.pathname;
 router.replace('/game');
 if(source==='/game')return;
 // Recover a stalled app-router transition on standalone room routes.
 window.setTimeout(()=>{if(window.location.pathname===source)window.location.replace('/game')},1500);
}
