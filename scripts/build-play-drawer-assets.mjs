import { execFileSync } from 'node:child_process';

const source = process.argv[2];
if (!source) throw new Error('Pass the current three-mode source PNG. The old two-mode source is retired.');
execFileSync(process.execPath, ['scripts/prepare-play-drawer-v2.cjs', source], { stdio: 'inherit' });
