const fs=require('node:fs'),assert=require('node:assert/strict');
const client=fs.readFileSync('app/(main)/battle/triad-dominion/TriadDominionClient.tsx','utf8');
for(const mode of ['pentad','heptad'])assert.ok(client.includes(`router.prefetch("/game/${mode}")`));
for(const name of ['Pentad','Heptad']){
 assert.ok(client.includes(`dynamic(prepare${name}Client`),'The rendered client reuses the warmed import');
 assert.ok(client.includes(`void prepare${name}Client().catch`),'Both room modules warm before create');
}
assert.ok(client.includes("module.loadHomeWallpaper('preparation')"));
const preview=client.slice(client.indexOf('if (creatingRoom) return'),client.indexOf('if (creatingRoom) return')+1000);
assert.ok(preview.includes('<BattleWaitingRoom'),'Create feedback uses the shared waiting room');
assert.ok(preview.includes('canChange={false} busy'),'No optimistic room mutations before server confirmation');
assert.ok(preview.includes('ยืนยันห้องกับเซิร์ฟเวอร์'),'Pending state does not pretend the server already accepted');
assert.ok(client.includes('setCreatingFormat(createFormat)'));
assert.ok(client.includes("setCreatingFormat('heptad');setCreatingRoom(true)"));
console.log('All modes: early route/module warmup, preparation background, immediate shared waiting UI and server-confirmed controls passed');
