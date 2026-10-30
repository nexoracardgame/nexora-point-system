const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');

// Generates local-only verification material; never print credentials or overwrite existing remote values.
const cli = process.argv[2];
if (!cli || !fs.existsSync(cli)) throw Error('Pass the installed Vercel CLI entry file');
const config = JSON.parse(fs.readFileSync('.vercel/project.json', 'utf8'));
if (config.projectId !== 'prj_P1yaTM6QhawrYfbKcdz2AP4soSOn') throw Error('Unexpected Vercel project');
const file = path.resolve('.vercel/noc-messenger-verify-token.txt');
if (!fs.existsSync(file)) fs.writeFileSync(file, crypto.randomBytes(32).toString('hex'), { flag: 'wx' });
const token = fs.readFileSync(file, 'utf8').trim();
if (!/^[a-f0-9]{64}$/.test(token)) throw Error('Invalid local verification material');
for (const [name, value] of [['NOC_META_VERIFY_TOKEN', token], ['NOC_META_PAGE_ID', '408021709324004']]) {
  const result = spawnSync(process.execPath, [cli, 'env', 'add', name, '--environment', 'production', '--sensitive', '--yes'], {
    input: value, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], timeout: 45000,
  });
  if (result.error || result.status !== 0) throw Error('Could not add ' + name + '; inspect remote variable names before retrying. Values were not printed.');
  console.log('Configured ' + name + ' for production');
}
console.log('Verification token retained only in ignored .vercel file. Messenger sending remains unconfigured/off.');
