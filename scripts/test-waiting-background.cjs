const fs=require('node:fs'),assert=require('node:assert/strict'),ts=require('typescript');
const m={exports:{}};
const jsx=(type,props)=>({type,props});
new Function('require','module','exports',ts.transpileModule(fs.readFileSync('components/BattleArenaHud.tsx','utf8'),{compilerOptions:{module:1,target:9,jsx:4}}).outputText)(id=>id==='react/jsx-runtime'?{jsx,jsxs:jsx}:id==='@/lib/home-wallpaper'?{PREPARATION_WALLPAPER_POSTER:'/preparation-poster.webp'}:{},m,m.exports);
for(const mode of ['pentad','heptad'])for(const phase of ['waiting','entering']){
 const result=m.exports.BattleArenaSurface({image:'/battle-arena.webp',[`data-${mode}-phase`]:phase});
 assert.ok(result.props.style.backgroundImage.includes('/preparation-poster.webp'));
 assert.ok(!result.props.style.backgroundImage.includes('/battle-arena.webp'),'No duel image even before the video mounts');
}
const preview=m.exports.BattleArenaSurface({image:'/battle-arena.webp',className:'nexora-room-create-preview'});
assert.ok(preview.props.style.backgroundImage.includes('/preparation-poster.webp'),'All three modes share safe creation background');
const battle=m.exports.BattleArenaSurface({image:'/battle-arena.webp','data-heptad-phase':'select'});
assert.ok(battle.props.style.backgroundImage.includes('/battle-arena.webp'),'Combat still uses the selected arena');
console.log('Room creation and entering/waiting phases never paint duel artwork; combat arena preserved');
