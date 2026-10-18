export type MonsterTier='bronze'|'silver'|'gold'|'diamond';
// Versioned, fixed bands: adding cards cannot silently re-rate existing cards.
export const monsterRatingPolicy={version:1,starMinimums:[0,8500,9000,9500,11000],tierMinimums:{bronze:0,silver:9000,gold:10000,diamond:14000}} as const;
export const monsterTiers={diamond:'Diamond',gold:'Gold',silver:'Silver',bronze:'Bronze'} as const;
export const monsterStarBands=monsterRatingPolicy.starMinimums.map((min,index)=>({stars:index+1,min,max:index<monsterRatingPolicy.starMinimums.length-1?monsterRatingPolicy.starMinimums[index+1]-1:null}));
export function rateMonster(card:{attack:number;support:number}){
 if(!Number.isSafeInteger(card.attack)||!Number.isSafeInteger(card.support)||card.attack<0||card.support<0)throw new Error('Invalid monster power');
 const totalPower=card.attack+card.support;
 if(!Number.isSafeInteger(totalPower))throw new Error('Invalid monster total power');
 const tier:MonsterTier=totalPower>=monsterRatingPolicy.tierMinimums.diamond?'diamond':totalPower>=monsterRatingPolicy.tierMinimums.gold?'gold':totalPower>=monsterRatingPolicy.tierMinimums.silver?'silver':'bronze';
 const stars=monsterRatingPolicy.starMinimums.filter(min=>totalPower>=min).length;
 return {totalPower,tier,stars,rarity:monsterTiers[tier],ratingVersion:monsterRatingPolicy.version};
}
