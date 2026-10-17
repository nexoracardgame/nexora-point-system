const fs = require('node:fs'), vm = require('node:vm'), ts = require('typescript'), crypto = require('node:crypto'), assert = require('node:assert/strict');
const output = {}, calls = [], secret = 'relay-test-secret';
let status = 200, fail = false;
vm.runInNewContext(ts.transpileModule(fs.readFileSync('app/api/noc-foam-discord-relay/route.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
  exports: output, require, Buffer, Response, AbortSignal, process: { env: { NOC_FOAM_WEBHOOK_SECRET: secret } },
  fetch: async (url, options) => {
    calls.push({ url, ...options });
    if (fail) throw Error('provider error containing credential');
    return Response.json(status === 200 ? { id: '1560911732455514182', bot: true, unnecessary: 'private-data' } : { code: 40333, message: 'provider error containing credential' }, { status });
  }
});
function signed(body, timestamp = String(Date.now())) {
  const raw = JSON.stringify(body);
  const signature = crypto.createHmac('sha256', secret).update('noc-discord-relay-v1\n' + timestamp + '\n' + raw).digest('hex');
  return new Request('https://example.test', { method: 'POST', body: raw, headers: { 'x-noc-timestamp': timestamp, 'x-noc-signature': signature } });
}
(async () => {
  assert.equal((await output.POST(new Request('https://example.test', { method: 'POST', body: '{}' }))).status, 401);
  assert.equal((await output.POST(signed({ path: '/gateway' }, '1000000000000'))).status, 401);
  const tampered = signed({ path: '/gateway' }); tampered.headers.set('x-noc-signature', '0'.repeat(64));
  assert.equal((await output.POST(tampered)).status, 401);
  assert.equal((await output.POST(signed({ path: 'https://other.test', method: 'GET' }))).status, 400);
  assert.equal((await output.POST(signed({ path: '/channels/999999999999999999', botToken: 'a'.repeat(60) }))).status, 400);
  assert.equal(calls.length, 0, 'Unsigned, stale and unsupported requests never reach Discord');
  const health = await (await output.POST(signed({ path: '/gateway' }))).json();
  assert.equal(health.status, 200); assert.equal(health.data.reachable, true);
  const identity = await (await output.POST(signed({ path: '/users/@me', botToken: 'a'.repeat(60) }))).json();
  assert.equal(identity.data.bot, true); assert.equal(identity.data.unnecessary, undefined);
  await output.POST(signed({ path: '/channels/1171820203508764786/messages', method: 'POST', botToken: 'a'.repeat(60), payload: { content: '@everyone test', allowed_mentions: { parse: ['everyone'] } } }));
  assert.deepEqual(JSON.parse(calls.at(-1).body).allowed_mentions.parse, []);
  assert.match(calls.at(-1).headers['User-Agent'], /^DiscordBot \(/);
  assert.equal(calls.at(-1).redirect, 'error');
  status = 403;
  const blocked = await (await output.POST(signed({ path: '/users/@me', botToken: 'a'.repeat(60) }))).json();
  assert.equal(blocked.status, 403); assert.equal(blocked.data.code, 40333);
  assert.ok(!JSON.stringify(blocked).includes('credential'));
  fail = true;
  assert.equal((await output.POST(signed({ path: '/gateway' }))).status, 502);
  console.log('PASS signed Discord relay: HMAC/freshness, fixed room/paths, no SSRF redirects, no mass mentions, safe errors and server health probe');
})().catch(e => { console.error(e); process.exitCode = 1; });
