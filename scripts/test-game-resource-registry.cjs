const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {collectGameResources}=require('./game-resource-registry.cjs');
const load=require('./game-collection-test-loader.cjs')(),{isGameResourceUrl}=load('lib/game-resource-policy.ts');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'nexora-registry-'));
const write=(file,body)=>{const full=path.join(root,file);fs.mkdirSync(path.dirname(full),{recursive:true});fs.writeFileSync(full,body)};
try{
 for(const file of ['ui/nested/new.png','audio/new.wav','models/new.glb','engine/new.wasm','shaders/new.wgsl','future/new.custom','data/new.json'])write('public/game-assets/'+file,'resource');
 write('public/uploads/player.png','private');write('public/game-assets/ui/mock-source.png','design');write('public/shared/banner.webp','shared');
 write('app/game/page.tsx',`import View from '../../future-view';export default View`);write('future-view.tsx',`export default()=> <img src="/shared/banner.webp"/>`);
 let result=collectGameResources(root);assert.equal(result.files.length,8);assert.ok(result.files.includes('/game-assets/future/new.custom'));assert.ok(result.files.includes('/shared/banner.webp'));assert.ok(!result.files.some(file=>file.includes('uploads')||file.includes('mock-source')));
 write('future-view.tsx',`export default()=> <img src="/shared/missing.png"/>`);assert.throws(()=>collectGameResources(root),/Missing game resource/);
 write('future-view.tsx',`export default()=> <img src="/game-assets/future/missing.custom"/>`);assert.throws(()=>collectGameResources(root),/Missing game resource/);
 for(const value of ['/api/private.png','/uploads/player.png','/game-assets/../secret.json','/game-assets/%2e%2e/secret.png','/%2fapi/private.png','//evil.test/a.png','/game-assets/a.png?x=1','/game-assets/%00file'])assert.equal(isGameResourceUrl(value),false,value);
 for(const value of ['/game-assets/future/new.custom','/battle-arenas/fire.webp','/battle-fx/audio/new.wav','/game-assets/engine/worker','/shared/banner.webp'])assert.equal(isGameResourceUrl(value),true,value);
 const actual=collectGameResources();assert.ok(!actual.files.includes('/game-release.json'),'Release control file must not recursively package itself');for(const file of actual.references)assert.ok(actual.files.includes(file));console.log('Resource registry: recursive future formats, imported-module audit, missing-file failure, live-data exclusion and URL safety passed; '+actual.files.length+' real files');
}finally{fs.rmSync(root,{recursive:true,force:true})}
