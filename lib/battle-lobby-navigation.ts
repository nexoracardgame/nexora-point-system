type Router={replace:(path:string)=>void};
// Inline room clients must release their parent before a same-route navigation.
export function returnToBattleLobby(router:Router,releaseInlineRoom?:()=>void){
 releaseInlineRoom?.();
 const source=window.location.pathname;
 router.replace('/game');
 if(releaseInlineRoom||source==='/game')return;
 // Recover a stalled app-router transition on standalone room routes.
 window.setTimeout(()=>{if(window.location.pathname===source)window.location.replace('/game')},1500);
}
