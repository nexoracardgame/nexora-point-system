"use client";
import {useEffect,useRef} from 'react';
import * as THREE from 'three';

export default function BattleDepthFX({color,skill,reduced}:{color:string;skill:boolean;reduced:boolean}){
 const ref=useRef<HTMLCanvasElement>(null);
 useEffect(()=>{
  const canvas=ref.current;if(!canvas||reduced)return;
  let renderer:THREE.WebGLRenderer;
  try{renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:false,powerPreference:'low-power'});}catch{return;}
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.25));
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(48,1,.1,40);camera.position.z=7;
  const geometry=new THREE.TorusGeometry(1,.012,4,64);
  const material=new THREE.MeshBasicMaterial({color,transparent:true,opacity:.55,blending:THREE.AdditiveBlending,depthWrite:false});
  const rings=Array.from({length:4},(_,i)=>{const mesh=new THREE.Mesh(geometry,material);mesh.rotation.set(.5+i*.4,i*.6,0);scene.add(mesh);return mesh});
  const shardsGeometry=new THREE.OctahedronGeometry(.045);
  const shards=Array.from({length:40},(_,i)=>{const mesh=new THREE.Mesh(shardsGeometry,material);const angle=i*2.399;mesh.position.set(Math.cos(angle)*(1+i%4*.35),Math.sin(angle)*(1+i%3*.4),(i%5-2)*.3);scene.add(mesh);return mesh});
  const resize=()=>{const r=canvas.getBoundingClientRect();renderer.setSize(r.width,r.height,false);camera.aspect=r.width/Math.max(1,r.height);camera.updateProjectionMatrix()};
  resize();const observer=new ResizeObserver(resize);observer.observe(canvas);
  let frame=0;const started=performance.now();
  const draw=()=>{const t=(performance.now()-started)/1000;
   if(!document.hidden){const pulse=skill ? .8+Math.sin(t*2)*.15 : 1+Math.max(0,Math.sin((t-1.1)*5))*.8;
    rings.forEach((ring,i)=>{ring.rotation.z=t*(i%2?-.7:.7);ring.rotation.y=t*.35+i;ring.scale.setScalar((.8+i*.22)*pulse)});
    shards.forEach((shard,i)=>{shard.rotation.x=t+i;shard.rotation.y=t*1.4;shard.position.z=Math.sin(t*1.5+i)*.7});
    renderer.render(scene,camera);canvas.dataset.rendered='true';
   }frame=requestAnimationFrame(draw);
  };draw();
  return()=>{cancelAnimationFrame(frame);observer.disconnect();geometry.dispose();shardsGeometry.dispose();material.dispose();renderer.dispose();renderer.forceContextLoss()};
 },[color,skill,reduced]);
 return <canvas ref={ref} data-battle-depth aria-hidden="true" style={{position:'absolute',inset:0,width:'100%',height:'100%',pointerEvents:'none',zIndex:0}}/>;
}
