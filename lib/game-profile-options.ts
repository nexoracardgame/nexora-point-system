export const gameHeroes=[{id:'gold',name:'ผู้พิทักษ์สุริยัน',image:'/images/versus/duelist-gold.png'},{id:'silver',name:'ผู้พิทักษ์จันทรา',image:'/images/versus/duelist-silver.png'}] as const;
export const gameFrames=[{id:'gold',name:'สุริยัน',color:'#e7c16e'},{id:'silver',name:'จันทรา',color:'#c5e5ff'},{id:'emerald',name:'มรกต',color:'#6ee2bd'}] as const;
export const gameAvatars=['/avatar.png','/cards/006.jpg','/cards/203.jpg','/cards/208.jpg','/cards/285.jpg'];
export type GameAppearance={avatar:string;frame:string;hero:string};
export const defaultGameAppearance:GameAppearance={avatar:'',frame:'gold',hero:'gold'};
