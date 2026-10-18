const fs=require('node:fs'),ts=require('typescript'),assert=require('node:assert/strict');
function load(file,resolve=require){const module={exports:{}};new Function('require','module','exports',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:1,target:9,esModuleInterop:true}}).outputText)(resolve,module,module.exports);return module.exports}
const {rateMonster,monsterRatingPolicy}=load('lib/game-monster-rating.ts');
const {triadCards}=load('lib/triad-dominion.ts',id=>require(id.replace('@/public','../public')));
const cards=triadCards.filter(card=>card.kind==='monster');
for(const attack of [-1,NaN,Infinity,1.5,Number.MAX_SAFE_INTEGER+1])assert.throws(()=>rateMonster({attack,support:0}));
assert.throws(()=>rateMonster({attack:Number.MAX_SAFE_INTEGER,support:1}));
for(let total=0;total<=20000;total++){
 const rating=rateMonster({attack:total,support:0});
 assert.equal(rating.totalPower,total);assert.ok(rating.stars>=1&&rating.stars<=5);
 if(total)assert.ok(rating.stars>=rateMonster({attack:total-1,support:0}).stars);
 assert.deepEqual(rateMonster({attack:0,support:total}),rating);
}
const tiers={},stars={};
for(const card of cards){const rating=rateMonster(card);assert.equal(rating.totalPower,card.attack+card.support);for(const element of ['earth','fire','gold','wood','water'])assert.deepEqual(rateMonster({...card,element}),rating);tiers[rating.rarity]=(tiers[rating.rarity]||0)+1;stars[rating.stars]=(stars[rating.stars]||0)+1;}
assert.equal(cards.length,205);assert.equal(Object.values(tiers).reduce((a,b)=>a+b,0),cards.length);
assert.equal(rateMonster(cards.find(card=>card.cardNo==='024')).totalPower,8600);
assert.equal(rateMonster(cards.find(card=>card.cardNo==='006')).totalPower,15000);
console.log(JSON.stringify({version:monsterRatingPolicy.version,count:cards.length,mean:cards.reduce((sum,card)=>sum+card.attack+card.support,0)/cards.length,tiers,stars}));
console.log('Ratings: boundaries, monotonicity, ATK/SUP symmetry, element independence and invalid data passed');
