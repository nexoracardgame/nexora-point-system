const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),yaml=require('js-yaml');
async function publishFeed(){
 const version=require('../desktop/game-config.cjs').extraMetadata.version,tag='game-v'+version;
 const base=`https://github.com/nexoracardgame/nexora-point-system/releases/download/${tag}/`;
 const directory=path.resolve('dist/game-desktop'),feed=yaml.load(fs.readFileSync(path.join(directory,'latest.yml'),'utf8'));
 if(feed.version!==version)throw Error('Feed/build version mismatch');
 for(const file of feed.files){
  if(path.basename(file.url)!==file.url||!file.url.endsWith('.exe'))throw Error('Unsafe artifact name');
  const local=path.join(directory,file.url),hash=crypto.createHash('sha512');let size=0;
  for await(const chunk of fs.createReadStream(local)){hash.update(chunk);size+=chunk.length}
  if(hash.digest('base64')!==file.sha512||size!==file.size)throw Error('Local artifact integrity failed');
  // Check the complete PUBLIC download, not only GitHub API metadata.
  const response=await fetch(base+file.url);if(!response.ok)throw Error('Release asset unavailable: '+response.status);
  const remote=crypto.createHash('sha512');let received=0;for await(const chunk of response.body){remote.update(chunk);received+=chunk.length}
  if(received!==size||remote.digest('base64')!==file.sha512)throw Error('Public download integrity failed');
  file.url=base+file.url;
 }
 feed.path=base+path.basename(feed.path);
 const destination='public/downloads/game-windows/latest.yml';
 fs.writeFileSync(destination,yaml.dump(feed,{lineWidth:-1}));
 fs.writeFileSync('public/downloads/game-windows/current.json',JSON.stringify({version,url:feed.path,sha512:feed.sha512,size:feed.files[0].size}));
 console.log('Verified public installer and staged updater feed '+version);
}
if(require.main===module)publishFeed().catch(error=>{console.error(error.message);process.exitCode=1});
module.exports={publishFeed};
