const fs=require('node:fs'),assert=require('node:assert/strict');
const {chromium}=require('C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 const page=await browser.newPage({viewport:{width:900,height:700}});
 await page.route('http://foil.test/**',route=>{const path=new URL(route.request().url()).pathname;if(path.startsWith('/cards/'))return route.fulfill({path:'public'+path});return route.fulfill({contentType:'text/html',body:`<style>body{margin:0}${fs.readFileSync('components/GameGacha.css','utf8')}</style><section class="game-gacha"><div class="gg-pack-stage"><span class="gg-pack gg-pack-front"><span class="gg-foil"><img src="/cards/card-backs/card-backs.png"></span></span></div></section>`})});
 await page.goto('http://foil.test/');const foil=page.locator('.gg-foil'),pack=page.locator('.gg-pack-front');
 await page.waitForFunction(()=>document.querySelector('img').naturalWidth>0);
 const crop=await foil.evaluate(node=>{const image=node.querySelector('img'),a=node.getBoundingClientRect(),b=image.getBoundingClientRect();return b.width>a.width&&b.height>a.height&&b.left<a.left&&b.top<a.top});assert.equal(crop,true);
 await page.mouse.move(890,690);const normal=await pack.evaluate(node=>getComputedStyle(node).filter);await foil.hover({force:true});await page.waitForTimeout(400);assert.notEqual(await pack.evaluate(node=>getComputedStyle(node).filter),normal);
 assert.equal(await foil.evaluate(node=>getComputedStyle(node,'::after').animationDuration),'1.6s');
 const before=await foil.evaluate(node=>getComputedStyle(node,'::after').backgroundPosition);await page.waitForTimeout(300);assert.notEqual(await foil.evaluate(node=>getComputedStyle(node,'::after').backgroundPosition),before);
 await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await foil.evaluate(node=>getComputedStyle(node,'::after').animationName),'none');
 await page.emulateMedia({reducedMotion:'no-preference'});await page.evaluate(()=>document.documentElement.dataset.gameMotionOff='true');assert.equal(await foil.evaluate(node=>getComputedStyle(node,'::after').animationName),'none');
 console.log('Card foil: cropped print bleed, moving reflection, hover aura and both reduced-motion controls passed');
}finally{await browser.close()}})().catch(error=>{console.error(error);process.exitCode=1});
