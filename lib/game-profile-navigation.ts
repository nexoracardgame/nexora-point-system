export function openGameProfile(id:string){
 window.dispatchEvent(new CustomEvent('nexora:open-game-profile',{detail:{id}}));
}
