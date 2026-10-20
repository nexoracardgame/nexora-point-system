const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),ts=require('typescript'),sharp=require('sharp');
const {chromium}=require('C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const modules={three:fs.readFileSync(require.resolve('three'),'utf8'),fx:ts.transpileModule(fs.readFileSync('components/BattleDepthFX.tsx','utf8'),{compilerOptions:{module:1,target:9,jsx:4}}).outputText};
const core=path.join(path.dirname(require.resolve('three')),'three.core.cjs');if(fs.existsSync(core))modules['./three.core.cjs']=fs.readFileSync(core,'utf8');
for(const[id,pkg,file]of[['react','react','react.production.js'],['react/jsx-runtime','react','react-jsx-runtime.production.js'],['react-dom','react-dom','react-dom.production.js'],['react-dom/client','react-dom','react-dom-client.production.js'],['scheduler','scheduler','scheduler.production.js']])modules[id]=fs.readFileSync(path.join(path.dirname(require.resolve(pkg)),'cjs',file),'utf8');
const app=require('esbuild').buildSync({stdin:{contents:`import React from 'react';import {createRoot} from 'react-dom/client';import FX from './components/BattleDepthFX';const root=createRoot(document.getElementById('root'));window.show=(reduced=false)=>root.render(React.createElement(FX,{color:'#ffb84d',skill:false,reduced}));window.show();`,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,format:'iife',define:{'process.env.NODE_ENV':'"production"'}}).outputFiles[0].text;
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-swiftshader']});try{
 for(const[width,height]of[[1920,1080],[844,390]]){
  const page=await browser.newPage({viewport:{width,height}}),errors=[];page.on('pageerror',e=>{errors.push(e.message);console.error(e.message)});page.on('console',m=>{if(m.type()==='error')console.error(m.text())});await page.setContent('<style>body{margin:0;background:#000}#root{position:absolute;inset:0}</style><div id="root"></div>');await page.addScriptTag({content:app});await page.waitForSelector('[data-rendered=true]');
  const first=await page.screenshot();await page.waitForTimeout(350);const second=await page.screenshot();const stats=await sharp(second).stats();assert.ok(stats.channels.some(c=>c.max>50&&c.stdev>1),'3D canvas has visible colored pixels');assert.notDeepEqual(first,second,'3D energy moves');
  const box=await page.locator('canvas').boundingBox();assert.equal(box.width,width);assert.equal(box.height,height);
  fs.mkdirSync('artifacts/battle-depth',{recursive:true});fs.writeFileSync(`artifacts/battle-depth/${width}.png`,second);
  await page.evaluate(()=>show(true));await page.waitForTimeout(50);assert.deepEqual(errors,[]);await page.close();console.log(`${width}x${height}: Three.js visible pixels, movement, full-bleed bounds and cleanup passed`);
 }
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
