const fs=require('node:fs'),assert=require('node:assert/strict');
const {chromium}=require('C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const css=['GameLobbyProfile','GamePlayerProfile','GameProfileFrame','BattlePlayerProfile'].map(name=>fs.readFileSync(`components/${name}.css`,'utf8')).join('\n');
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 fs.mkdirSync('artifacts/profile-reflections',{recursive:true});
 for(const [width,height]of [[3840,2160],[1920,1080],[844,390],[568,320]]){
  const page=await browser.newPage({viewport:{width,height}});
  await page.route('http://reflections.test/**',route=>route.fulfill({path:'public'+new URL(route.request().url()).pathname}));
  await page.setContent(`<base href="http://reflections.test/"><style>${css}body{background:#3c5050}.sample{position:relative;width:280px;height:100px}.bpi-copy{width:230px}.battle-player-mini{left:10px;top:220px;width:250px}img{max-width:100%}</style><div class="sample"><span class="bpi-copy"><img class="bpi-name-frame" src="/images/lobby-play/profile-name-frame.png"></span></div><div class="sample" data-player="true"><span class="bpi-copy"><img class="bpi-name-frame" src="/images/lobby-play/profile-name-frame.png"></span></div><div class="gpp-framed-name"></div><div class="gpp-framed-rank"></div><div class="nli-plate-light"></div><div class="battle-player-mini">Profile outline</div>`);
  for(const selector of ['.bpi-copy','.gpp-framed-name','.gpp-framed-rank'])for(const node of await page.locator(selector).all())assert.equal(await node.evaluate(n=>getComputedStyle(n,'::after').display),'none',`${selector} cannot flash opaque masked backing`);
  assert.equal(await page.locator('.nli-plate-light').evaluate(n=>getComputedStyle(n).display),'none');
  assert.equal(await page.locator('.battle-player-mini').evaluate(n=>getComputedStyle(n,'::before').animationName),'bpp-aura','Separate clean mini-profile outline glow remains');
  await page.screenshot({path:`artifacts/profile-reflections/${width}.png`});await page.close();console.log(`${width}x${height}: arena both sides, main profile and lobby have no cut-edge reflection overlay; clean outline preserved`);
 }
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
