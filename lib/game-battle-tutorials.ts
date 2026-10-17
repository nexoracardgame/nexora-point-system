type BattleTutorial={id:string;title:string;poster:string;video:string|null};

// Add shipped videos under public/game-assets/ so resource verification covers them.
export const gameBattleTutorials:readonly BattleTutorial[]=[
 {id:'battle-basics',title:'พื้นฐานการต่อสู้',poster:'/images/triad/nexora-world-small.webp',video:null},
 {id:'card-elements',title:'รู้จักการ์ดและธาตุ',poster:'/images/triad/nexora-duelists-small.webp',video:null},
 {id:'build-deck',title:'จัดเด็คก่อนลงสนาม',poster:'/images/triad/nexora-command-detail.webp',video:null},
 {id:'triad',title:'สนามประลอง TRIAD',poster:'/images/triad/nexora-duelists.webp',video:null},
 {id:'pentad',title:'สนามประลอง PENTAD',poster:'/images/triad/nexora-world.webp',video:null},
 {id:'card-skills',title:'ทักษะและกลยุทธ์การ์ด',poster:'/images/triad/nexora-command-original.webp',video:null},
];
