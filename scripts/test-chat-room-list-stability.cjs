const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const source = fs.readFileSync('lib/chat-room-list-reconcile.ts', 'utf8');
const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const mod = { exports: {} };
new Function('exports', 'module', output)(mod.exports, mod);
const { reconcileRoomList } = mod.exports;
const room = (key, day) => ({ key, createdAt: `2026-10-${day}T00:00:00Z` });
const a = room('a', 10), b = room('b', 11), newer = room('a', 12), added = room('c', 13);
assert.deepEqual(reconcileRoomList([newer, b, added], [a, b], [a, b]), [added, newer, b]);
assert.deepEqual(reconcileRoomList([a, b], [b], [a, b]), [b], 'Explicit removals remain supported');
assert.deepEqual(reconcileRoomList([a, b], [], [a, b]), []);
assert.deepEqual(reconcileRoomList([b, a], [b, a], [b, a]), [b, a]);
const server = fs.readFileSync('lib/dm-list.ts', 'utf8');
assert.match(server, /missingRoomIds/);
assert.match(server, /offset \+= 8/);
assert.doesNotMatch(server, /console.error\([^;]+;\s*return \[\]/);
console.log('Chat list stability: PASS (newer previews, realtime additions, deletions, stable order, failure handling)');

async function testServer() {
  let fail = false;
  const message = (roomId, day) => ({ id: day, roomId, content: roomId, createdAt: `2026-10-${day}T00:00:00Z`, senderId: 'peer' });
  const queries = [];
  const supabase = { from(table) {
    const state = { table };
    const chain = new Proxy({}, { get(_, key) {
      if (key === 'then') return (resolve) => {
        queries.push(state);
        const data = table === 'dm_room'
          ? ['busy', 'quiet'].map(roomid => ({ roomid, usera: 'me', userb: roomid, updatedat: '2026-10-01' }))
          : state.roomId ? [message(state.roomId, 10)] : state.unread ? [] : [message('busy', 19)];
        return Promise.resolve({ data, error: fail ? new Error('offline') : null }).then(resolve);
      };
      return (...args) => {
        if (key === 'eq' && args[0] === 'roomId') state.roomId = args[1];
        if (key === 'is') state.unread = true;
        return chain;
      };
    } });
    return chain;
  } };
  const dependencies = {
    '@/lib/deal-chat': { getDealChatRoomId: id => id, isDealChatRoomId: () => false },
    '@/lib/card-image': {},
    '@/lib/auction-deal-chat': { getAuctionDealRoomSeedsForUser: async () => [] },
    '@/lib/dm-room-clear-state': {
      getDmRoomClearedAtMap: async () => new Map(),
      getDmConversationClearedAtMap: async () => new Map(),
      getLatestClearTimestamp: () => null,
      isRoomActivityVisibleAfterClear: () => true,
    },
    '@/lib/local-profile-store': { getLocalProfilesByUserIds: async () => new Map() },
    '@/lib/prisma': { prisma: { dealRequest: { findMany: async () => [] }, user: { findMany: async () => [] } } },
    '@/lib/supabase-server': { getServerSupabaseClient: () => supabase },
  };
  const serverModule = { exports: {} };
  const compiled = ts.transpileModule(server, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  new Function('require', 'module', 'exports', compiled)(id => dependencies[id], serverModule, serverModule.exports);
  const rooms = await serverModule.exports.getDmRoomsForUser('me');
  assert.equal(rooms.length, 2);
  assert.equal(rooms.find(r => r.roomId === 'quiet').lastMessage, 'quiet');
  assert.equal(rooms[0].roomId, 'busy');
  assert.equal(queries.filter(q => q.roomId === 'quiet').length, 1);
  fail = true;
  await assert.rejects(serverModule.exports.getDmRoomsForUser('me'));
  console.log('DM server: PASS (busy-room window, quiet-room history, failure is not an empty list)');
}
testServer().catch(error => { console.error(error); process.exitCode = 1; });
