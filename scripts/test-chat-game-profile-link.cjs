const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('components/FloatingChatDock.tsx','utf8');
const start=source.indexOf('  const profileUserId ='),end=source.indexOf('  const activeOtherOnline',start);
assert.ok(start>0&&end>start);
for(const pathname of ['/game','/game/pentad','/game/profile','/community']){
 for(const activeRoom of [{other:{id:'friend/123'}},{otherUserId:'friend/123'},null]){
 const context=vm.createContext({pathname,activeRoom,encodeURIComponent});
 const actual=vm.runInContext(source.slice(start,end)+'activeProfileHref',context);
 assert.equal(actual,activeRoom?`${pathname.startsWith('/game')?'/game/profile':'/profile'}/friend%2F123`:'');
 }
}
console.log('Chat profile navigation: game/web contexts, both participant ID fields, escaped IDs and empty rooms passed');
