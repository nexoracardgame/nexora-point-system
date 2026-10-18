const fs=require('node:fs'),assert=require('node:assert/strict'),sharp=require('sharp'),crypto=require('node:crypto');
(async()=>{
 const set=require('../public/game-assets/branding/icon-set.json'),source=fs.readFileSync('public'+set.source),release=require('../public/game-release.json');
 const pixels=await sharp(source).ensureAlpha().raw().toBuffer();assert.equal(crypto.createHash('sha256').update(pixels).digest('hex').slice(0,16),set.version);
 for(const [size,url]of Object.entries(set.icons)){
  const actual=await sharp('public'+url).ensureAlpha().raw().toBuffer(),expected=await sharp(source).resize(Number(size),Number(size)).ensureAlpha().raw().toBuffer();assert.deepEqual(actual,expected);
  assert.ok(release.resources.some(item=>item.url===url));
  if([16,32,48,192,512].includes(Number(size)))assert.deepEqual(fs.readFileSync('public'+url),fs.readFileSync(`public/game-icons/icon-${size}.png`));
 }
 const ico=fs.readFileSync('desktop/assets/game-icon.ico');assert.deepEqual(ico,fs.readFileSync('public'+set.favicon));assert.deepEqual(ico,fs.readFileSync('public/game-icons/favicon.ico'));assert.equal(ico.readUInt16LE(2),1);
 const sizes=[];for(let i=0;i<ico.readUInt16LE(4);i++){const entry=6+i*16,size=ico[entry]||256,length=ico.readUInt32LE(entry+8),offset=ico.readUInt32LE(entry+12);const actual=await sharp(ico.subarray(offset,offset+length)).raw().toBuffer();const expected=await sharp('public'+set.icons['512']).resize(size,size,{fit:'cover'}).raw().toBuffer();assert.deepEqual(actual,expected);sizes.push(size)}
 assert.deepEqual(sizes,[16,24,32,48,64,128,256]);
 const config=require('../desktop/game-config.cjs');for(const key of ['installerIcon','uninstallerIcon','installerHeaderIcon'])assert.equal(config.nsis[key],'desktop/assets/game-icon.ico');assert.equal(config.win.icon,'desktop/assets/game-icon.ico');
 console.log(`Game icon ${set.version}: ${Object.keys(set.icons).length} PNG sizes, browser/native ICO frames, legacy aliases and resource manifest passed`);
})().catch(error=>{console.error(error);process.exitCode=1});
