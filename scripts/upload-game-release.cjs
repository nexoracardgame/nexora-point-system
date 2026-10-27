const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
async function upload(){
 const version=require('../desktop/game-config.cjs').extraMetadata.version,tag='game-v'+version;
 // Git's configured credential helper supplies authentication; never log it.
 const credential=execFileSync('git',['credential','fill'],{input:'protocol=https\nhost=github.com\n\n',encoding:'utf8'});
 const token=credential.split(/\r?\n/).find(line=>line.startsWith('password='))?.slice(9);
 if(!token)throw Error('GitHub authentication is unavailable');
 const headers={Authorization:`Bearer ${token}`,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'};
 const base='https://api.github.com/repos/nexoracardgame/nexora-point-system/releases';
 let response=await fetch(base+'/tags/'+tag,{headers}),release;
 if(response.status===404){response=await fetch(base,{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({tag_name:tag,name:`NEXORA CARD GAME ${version}`,draft:true,body:'Native login completes provider navigation, returns to the game and prevents a stuck browser loading screen. Includes verified bundled game resources.'})});}
 if(!response.ok)throw Error('Release access failed: '+response.status);release=await response.json();
 for(const name of [`NEXORA-CARD-GAME-Setup-${version}.exe`,`NEXORA-CARD-GAME-Setup-${version}.exe.blockmap`,'latest.yml']){
  const file=path.resolve('dist/game-desktop',name),size=fs.statSync(file).size;
  const hash=require('node:crypto').createHash('sha256');
  for await(const chunk of fs.createReadStream(file))hash.update(chunk);
  const digest='sha256:'+hash.digest('hex'),existing=release.assets.find(asset=>asset.name===name);
  if(existing){
   if(existing.digest===digest&&existing.size===size){console.log('Verified existing asset: '+name);continue;}
   if(!release.draft)throw Error('Published asset differs; use a new version: '+name);
   const removed=await fetch(existing.url,{method:'DELETE',headers});
   if(!removed.ok)throw Error('Draft asset replacement failed: '+removed.status);
  }
  const result=await fetch(release.upload_url.split('{')[0]+'?name='+encodeURIComponent(name),{method:'POST',headers:{...headers,'Content-Type':'application/octet-stream','Content-Length':String(size)},body:fs.createReadStream(file),duplex:'half'});
  if(!result.ok)throw Error('Asset upload failed: '+result.status);console.log('Uploaded '+name+' ('+size+' bytes)');
 }
 const published=await fetch(base+'/'+release.id,{method:'PATCH',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({draft:false})});
 if(!published.ok)throw Error('Release publication failed: '+published.status);
 console.log('Published '+tag);
}
if(require.main===module)upload().catch(error=>{console.error(error.message);process.exitCode=1});
