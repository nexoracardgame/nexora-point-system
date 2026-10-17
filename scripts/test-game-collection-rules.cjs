const assert=require('node:assert/strict'),load=require('./game-collection-test-loader.cjs')();
const {triadCards,triadCardByNo}=load('lib/triad-dominion.ts'),rules=load('lib/game-collection.ts'),{validateTriadDeckMode}=load('lib/triad-deck-rules.ts');
// Frozen pre-inventory battle contract, independent of the current Git checkout.
function oldValidate(mode,deck){const counts=deck.reduce((counts,no)=>{const card=triadCardByNo.get(no);if(!card||card.kind==='unknown')return counts;counts.total++;if(card.kind==='monster')counts.monsters++;if(card.kind==='skill')counts.skills++;return counts},{total:0,monsters:0,skills:0}),errors=[];
 if(counts.total!==20)errors.push('เด็คต้องมีการ์ดทั้งหมด 20 ใบ');
 if(mode==='all'){if(counts.monsters<3)errors.push('โหมด ALL IN ONE ต้องมีการ์ดมอนสเตอร์อย่างน้อย 3 ใบ');return {ok:errors.length===0,errors}}
 if(mode==='monster'){if(counts.monsters!==20||counts.skills>0)errors.push('โหมด MONSTER ต้องใช้การ์ดมอนสเตอร์ครบ 20 ใบ');return {ok:errors.length===0,errors}}
 if(counts.monsters!==10||counts.skills!==10)errors.push('โหมด SKILL ต้องมีการ์ดมอนสเตอร์ 10 ใบ และการ์ดสกิล 10 ใบ');return {ok:errors.length===0,errors};
}
let seed=81;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
for(let i=0;i<500;i++){const deck=Array.from({length:Math.floor(random()*26)},()=>random()<.02?'bad':triadCards[Math.floor(random()*triadCards.length)].cardNo);for(const mode of ['all','monster','skill'])assert.deepEqual(validateTriadDeckMode(mode,deck),oldValidate(mode,deck),'Battle validator contract unchanged')}
const monster=triadCards.find(card=>card.kind==='monster').cardNo,skill=triadCards.find(card=>card.kind==='skill').cardNo;
const owned=[{cardNo:monster,quantity:20},{cardNo:skill,quantity:20}];
let cards=rules.emptyDeckCards();cards.main=Array(20).fill(monster);assert.deepEqual(rules.validateCollectionDeck('triad-monster',cards,owned),[]);
assert.ok(rules.validateCollectionDeck('triad-monster',cards,[{cardNo:monster,quantity:19}]).some(error=>error.includes('เป็นเจ้าของ')));
cards.main=[...Array(10).fill(monster),...Array(10).fill(skill)];assert.deepEqual(rules.validateCollectionDeck('triad-skill',cards,owned),[]);
cards.main=[];assert.deepEqual(rules.validateCollectionDeck('triad-all',cards,owned,true),[]);assert.ok(rules.validateCollectionDeck('triad-all',cards,owned).length);
cards=rules.emptyDeckCards();cards.hand=[skill];cards.reserve=[skill];assert.ok(rules.validateCollectionDeck('pentad',cards,owned,true).some(error=>error.includes('เพียง 1 ใบ')));
cards=rules.emptyDeckCards();cards.monsters=[skill];assert.ok(rules.validateCollectionDeck('pentad',cards,owned,true).some(error=>error.includes('ประเภท')));
assert.throws(()=>rules.parseDeckCards({main:['999999'],monsters:[],hand:[],reserve:[]}));assert.throws(()=>rules.parseDeckCards({main:'001'}));
console.log('Collection rules: 1500 battle parity cases, ownership limits, drafts, TRIAD/PENTAD groups and invalid input passed');
