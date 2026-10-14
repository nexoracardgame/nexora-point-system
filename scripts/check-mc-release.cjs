const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const required = [
  'app/api/mc-profile-photo/route.ts',
  'app/api/mc-discord/login/route.ts',
  'app/api/mc-discord/approval-history.ts',
  'app/api/mc-discord/events.ts',
  'app/api/mc-discord/event-map.ts',
  'app/api/mc-discord/map-assets.json',
  'public/mc-avatars/male-15.webp',
  'public/mc-map/vendor/leaflet.js',
  'public/mc-map/vendor/leaflet.css',
  'public/mc-roster-background-20260930.webp',
];
const missing = required.filter(file => !fs.existsSync(path.join(root, file)));
const route = fs.readFileSync(path.join(root, 'app/api/mc-discord/route.ts'), 'utf8');
for (const action of ['set-nickname', 'oauth-login', 'event-notify', 'approval-history']) {
  if (!route.includes('"' + action + '"')) missing.push('Discord action: ' + action);
}
for (const layer of ['1', '2', '3']) {
  const directory = path.join(root, 'public/mc-map', layer);
  if (!fs.existsSync(path.join(directory, '0/0/0.webp'))) missing.push('map layer: ' + layer);
}
if (missing.length) {
  console.error('MC release is incomplete. Refusing to publish without:\n' + missing.join('\n'));
  process.exitCode = 1;
} else console.log('MC release verified: Discord actions, photo API, login, avatar assets and map layers');
