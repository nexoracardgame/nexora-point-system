const assert=require('node:assert/strict');
const {chromium}=require('C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const set=require('../public/game-assets/branding/icon-set.json');
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 const page=await browser.newPage(),base=process.env.ICON_TEST_BASE||'http://localhost:3010';
 await page.goto(base+'/game');
 const icons=await page.locator('link[rel="icon"],link[rel="shortcut icon"],link[rel="apple-touch-icon"]').evaluateAll(nodes=>nodes.map(node=>node.getAttribute('href')));
 assert.ok(icons.length);assert.ok(icons.every(url=>url.startsWith('/game-assets/branding/')&&url.endsWith('?v='+set.version)));
 for(const icon of icons)assert.equal((await page.request.get(base+icon)).status(),200);
 const manifest=await (await page.request.get(base+'/game/manifest.webmanifest')).json();assert.ok(manifest.icons.every(icon=>icon.src.endsWith('?v='+set.version)));
 console.log('Browser tab, Apple touch and PWA icon URLs passed: '+set.version);
}finally{await browser.close()}})().catch(error=>{console.error(error);process.exitCode=1});
