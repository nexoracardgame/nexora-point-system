// Checkout services must resolve package IDs from this catalog, never client totals.
export const gameCoinPackages = [
 {id:'coin-35',baht:35,base:70,bonusPercent:0,bonus:0,total:70},
 {id:'coin-99',baht:99,base:198,bonusPercent:5,bonus:10,total:208},
 {id:'coin-199',baht:199,base:398,bonusPercent:8,bonus:32,total:430},
 {id:'coin-499',baht:499,base:998,bonusPercent:10,bonus:100,total:1098},
 {id:'coin-999',baht:999,base:1998,bonusPercent:12,bonus:240,total:2238},
 {id:'coin-1999',baht:1999,base:3998,bonusPercent:15,bonus:600,total:4598},
] as const;
