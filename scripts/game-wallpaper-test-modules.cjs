const fs=require('node:fs'),ts=require('typescript');
module.exports=modules=>{
 for(const [id,file]of [['./GameEntryBackground','components/GameEntryBackground.tsx'],['@/lib/game-entry-wallpaper','lib/game-entry-wallpaper.ts']])modules[id]=ts.transpileModule(fs.readFileSync(file,'utf8'),{fileName:file,compilerOptions:{module:1,target:9,jsx:4,esModuleInterop:true}}).outputText;
 for(const folder of ['entry-loop-3','shop-loop-5','collection-loop-6','monster-loop-8'])modules[`../public/game-assets/video/${folder}/manifest.json`]='module.exports='+fs.readFileSync(`public/game-assets/video/${folder}/manifest.json`,'utf8');
 modules['./GameEntryBackground.css']=' ';
 return modules;
};
