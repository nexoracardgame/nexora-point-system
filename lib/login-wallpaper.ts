export async function loadLoginWallpaper(signal?:AbortSignal){
  const base='/videos/nexora-login-4k/';
  const response=await fetch(base+'manifest.json',{signal});if(!response.ok)throw Error('Login wallpaper unavailable');
  const manifest=await response.json() as {width:number;height:number;bytes:number;sha256:string;parts:string[]};
  if(manifest.width!==3840||manifest.height!==2160)throw Error('4K required');
  const blobs:Blob[]=[];
  for(const part of manifest.parts){if(!/^part-\d+\.bin$/.test(part))throw Error('Invalid video part');const response=await fetch(base+part+'?v='+manifest.sha256,{signal});if(!response.ok)throw Error('Video part unavailable');blobs.push(await response.blob())}
  const video=new Blob(blobs,{type:'video/mp4'});if(video.size!==manifest.bytes)throw Error('Incomplete login video');
  return URL.createObjectURL(video);
}
