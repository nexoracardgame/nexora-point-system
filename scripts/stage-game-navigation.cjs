const {execFileSync}=require('node:child_process'),fs=require('node:fs');
const file='app/(main)/battle/triad-dominion/TriadDominionClient.tsx';
let source=execFileSync('git',['show',`HEAD:${file}`],{encoding:'utf8'}).replace(/\r/g,'');
const oldMenu=`      <nav className="nexora-command-nav" aria-label="เมนูเกม">
        <button onClick={() => onNavigate("/collections")}><Layers3 />การ์ดของฉัน</button>
        <button onClick={() => onNavigate("/community")}><Users />เพื่อน</button>
        <button onClick={() => setPanel("rank")} aria-pressed={panel === "rank"}><Trophy />อันดับนักดวล</button>
        <button onClick={() => onNavigate("/")}><House />เว็บหลัก</button>
      </nav>`;
const nextMenu=`      <GameLobbyNavigation onRank={() => setPanel("rank")} onHome={() => { setPanel(null); setPanelClosing(false); }} />`;
if(!source.includes(oldMenu))throw Error('Expected original menu missing');
source=source.replace('"use client";','"use client";\nimport GameLobbyNavigation from \'@/components/GameLobbyNavigation\';').replace(oldMenu,nextMenu);
if(!fs.readFileSync(file,'utf8').includes(nextMenu))throw Error('Working tree does not contain the scoped menu change');
const blob=execFileSync('git',['hash-object','-w','--stdin'],{input:source,encoding:'utf8'}).trim();
execFileSync('git',['update-index','--cacheinfo',`100644,${blob},${file}`]);
console.log('Staged only game navigation import and menu replacement; preserved unrelated arena edits');
