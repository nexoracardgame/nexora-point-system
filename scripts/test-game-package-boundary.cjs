const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const config=require('../desktop/game-config.cjs');
const {getNodeModuleFileMatcher}=require('app-builder-lib/out/fileMatcher');
const app=path.resolve('desktop'),destination=path.resolve('dist/game-desktop/win-unpacked/resources/app');
const matcher=getNodeModuleFileMatcher(app,destination,value=>value,{}, {config,debugLogger:{isEnabled:false}}),filter=matcher.createFilter();
for(const name of ['next','@prisma/client','@tensorflow/tfjs','electron-updater'])assert.equal(filter(path.join(app,'node_modules',name,'index.js'),{isDirectory:()=>false,moduleFullFilePath:'node_modules/'+name+'/index.js'}),false,'Disable automatically collected dependency: '+name);
assert.deepEqual(config.extraFiles,[{from:'desktop/node_modules',to:'resources/app/node_modules',filter:['**/*','!**/.bin/**','!**/.package-lock.json']}]);
const expected=require('../desktop/package-lock.json').packages;
if(fs.existsSync(destination)){
 const modules=path.join(destination,'node_modules');
 for(const entry of fs.readdirSync(modules,{withFileTypes:true})){if(!entry.isDirectory()||entry.name.startsWith('.'))continue;const names=entry.name.startsWith('@')?fs.readdirSync(path.join(modules,entry.name)).map(name=>entry.name+'/'+name):[entry.name];for(const name of names)assert.ok(expected['node_modules/'+name],'Unexpected packaged dependency: '+name)}
 const resolve=require('node:module').createRequire(path.join(destination,'package.json')).resolve;
 assert.ok(resolve('electron-updater').startsWith(modules+path.sep));
}
console.log('Desktop package boundary: automatic website tree excluded, explicit isolated runtime and updater resolution passed');
