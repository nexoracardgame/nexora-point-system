const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
const env = {
  NOC_DISCORD_PUBLIC_KEY: publicKey.export({ format: 'der', type: 'spki' }).subarray(-32).toString('hex'),
  NOC_DISCORD_APPLICATION_ID: '111111111111111111', NOC_DISCORD_CONTROL_SECRET: 'control-test', NOC_FOAM_WEBHOOK_SECRET: 'webhook-test'
};
const callbacks = [], calls = [], output = {};
let upstreamFail = false;
vm.runInNewContext(ts.transpileModule(fs.readFileSync('app/api/noc-foam-discord/route.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText, {
  exports: output, Buffer, Response, URL, AbortSignal, console, process: { env },
  require: name => name === 'next/server' ? { after: fn => callbacks.push(fn) } : require(name),
  fetch: async (url, options) => {
    calls.push({ url: String(url), ...options });
    if (String(url).includes('script.google.com')) {
      if (upstreamFail) throw Error('offline');
      return Response.json({ ok: true, message: 'พัก AI แล้วครับ' });
    }
    return Response.json({});
  }
});
const customer = 'U' + 'a'.repeat(32);
const interaction = { type: 3, application_id: env.NOC_DISCORD_APPLICATION_ID, id: '222222222222222222', token: 'test-token', guild_id: '333333333333333333', channel_id: '444444444444444444', member: { user: { id: '555555555555555555' } }, data: { component_type: 2, custom_id: 'noc:idle:' + customer } };
function signed(body, timestamp = String(Math.floor(Date.now() / 1000))) {
  const raw = JSON.stringify(body);
  const signature = crypto.sign(null, Buffer.from(timestamp + raw), privateKey).toString('hex');
  return new Request('https://example.test/api/noc-foam-discord', { method: 'POST', body: raw, headers: { 'x-signature-ed25519': signature, 'x-signature-timestamp': timestamp } });
}
(async () => {
  assert.equal((await output.POST(new Request('https://example.test', { method: 'POST', body: '{}' }))).status, 401);
  assert.equal((await output.POST(signed({ type: 1 }, '1000000000'))).status, 401);
  const bad = signed({ type: 1 });
  bad.headers.set('x-signature-ed25519', '0'.repeat(128));
  assert.equal((await output.POST(bad)).status, 401);
  assert.equal((await (await output.POST(signed({ type: 1 }))).json()).type, 1);
  assert.equal((await output.POST(signed(null))).status, 400);
  const response = await (await output.POST(signed(interaction))).json();
  assert.equal(response.type, 5);
  assert.equal(response.data.flags, 64);
  assert.equal(calls.length, 0, 'No slow upstream call before Discord acknowledgment');
  await callbacks.shift()();
  const control = JSON.parse(calls[0].body);
  assert.equal(control.controlSecret, 'control-test');
  assert.equal(control.discordControl.userId, interaction.member.user.id);
  assert.equal(control.discordControl.customId, interaction.data.custom_id);
  assert.equal(JSON.parse(calls[1].body).content, 'พัก AI แล้วครับ');
  assert.equal(JSON.parse(calls[1].body).allowed_mentions.parse.length, 0);
  assert.equal(calls[1].method, 'PATCH');
  const off = await (await output.POST(signed({ ...interaction, data: { component_type: 2, custom_id: 'noc:off:' + customer } }))).json();
  assert.equal(off.type, 4);
  assert.equal(off.data.flags, 64);
  assert.match(off.data.components[0].components[0].custom_id, /^noc:confirmoff:/);
  assert.equal(callbacks.length, 0, 'Permanent-off requires confirmation before mutation');
  await output.POST(signed({ ...interaction, data: { component_type: 2, custom_id: 'noc:confirmoff:' + customer } }));
  await callbacks.shift()();
  assert.equal(JSON.parse(calls[2].body).discordControl.customId, 'noc:off:' + customer);
  upstreamFail = true;
  await output.POST(signed(interaction));
  await callbacks.shift()();
  assert.match(JSON.parse(calls.at(-1).body).content, /ไม่สำเร็จ/);
  console.log('PASS NOC Discord endpoint: Ed25519, freshness, ping, deferred private results, separate control secret, off confirmation and honest failure');
})().catch(error => { console.error(error); process.exitCode = 1; });
