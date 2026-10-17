const fs=require('node:fs'),path=require('node:path'),{createHash}=require('node:crypto');
const {collectGameResources,policy}=require('./game-resource-registry.cjs');
const root=path.resolve('public'),registry=collectGameResources();
const settings=JSON.parse(fs.readFileSync('data/game-release.json','utf8'));
const resources=registry.files.map(url=>{const data=fs.readFileSync(path.join(root,url));return{url,bytes:data.length,sha256:createHash('sha256').update(data).digest('hex'),mimeType:policy.mimeTypes[path.extname(url).slice(1).toLowerCase()]||'application/octet-stream'}});
const policyHash=createHash('sha256').update(JSON.stringify(policy)).digest('hex');
const version=createHash('sha256').update(JSON.stringify({settings,policyHash,resources})).digest('hex').slice(0,20);
fs.writeFileSync('public/game-release.json',JSON.stringify({...settings,schemaVersion:2,policyHash,version,totalBytes:resources.reduce((n,r)=>n+r.bytes,0),resources}));
console.log(`Game patch ${version}: ${resources.length} files, ${resources.reduce((n,r)=>n+r.bytes,0)} bytes; audited ${registry.sourceCount} source files, ${registry.references.length} static references`);
