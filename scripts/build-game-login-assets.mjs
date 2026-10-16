import sharp from 'sharp';
import {mkdir,copyFile} from 'node:fs/promises';
const destination='public/images/game-login';
await mkdir(destination,{recursive:true});
const sources={login:'9df60acc-bf85-427c-b8f9-e4d4cd7c5187.png',register:'264a19e8-7f6e-4f70-a8c3-ec08e43a8f19.png',navigation:'dac6adf9-63af-4fff-a2f6-5df85c250582.png',social:'d69e9c00-4d14-4ed1-93f6-3983ecfef72b.png'};
if(process.argv.includes('--import'))for(const [name,file]of Object.entries(sources))await copyFile(`C:/Users/USER/Downloads/${file}`,`${destination}/${name}-source.png`);
for(const name of ['login','register'])await sharp(`${destination}/${name}-source.png`).resize({width:1200,withoutEnlargement:true}).webp({quality:94,alphaQuality:100}).toFile(`${destination}/${name}.webp`);
for(const [name,labels]of [['social',['google','line','facebook','discord','apple']],['navigation',['news','event','guide','support']]]){
 const {width,height}=await sharp(`${destination}/${name}-source.png`).metadata();
 for(const [index,label]of labels.entries()){
  const left=Math.round(index*width/labels.length),right=Math.round((index+1)*width/labels.length);
  await sharp(`${destination}/${name}-source.png`).extract({left,top:0,width:right-left,height}).resize({height:360,withoutEnlargement:true}).webp({quality:94,alphaQuality:100}).toFile(`${destination}/${label}.webp`);
 }
}
console.log('Game login artwork and individual social/navigation sprites generated');
if(process.argv.includes('--new-form')){
 await copyFile('C:/Users/USER/Downloads/c9f4fd8a-9eb3-4976-ba9a-c0fa59002b0b.png',`${destination}/form-source.png`);
 await copyFile('C:/Users/USER/Downloads/d0e4c328-ee0c-4858-8108-5efb49fec58b.png',`${destination}/plain-social-source.png`);
 await sharp(`${destination}/form-source.png`).webp({quality:96,alphaQuality:100}).toFile(`${destination}/form.webp`);
 const edges=[0,435,950,1280,1776],labels=['google','line','facebook','discord'];
 for(const [index,label]of labels.entries())await sharp(`${destination}/plain-social-source.png`).extract({left:edges[index],top:60,width:edges[index+1]-edges[index],height:510}).resize({height:150}).webp({quality:96,alphaQuality:100}).toFile(`${destination}/plain-${label}.webp`);
}
