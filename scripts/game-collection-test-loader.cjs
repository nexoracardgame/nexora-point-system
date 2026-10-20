const fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
module.exports=function createLoader(overrides={}){
 const cache=new Map();
 function load(file){const full=path.resolve(file);if(cache.has(full))return cache.get(full).exports;const mod={exports:{}};cache.set(full,mod);const code=ts.transpileModule(fs.readFileSync(full,'utf8'),{fileName:full,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
  const local=id=>{if(Object.hasOwn(overrides,id))return overrides[id];if(id.startsWith('.')||id.startsWith('@/')){let target=id.startsWith('@/')?path.resolve(id.slice(2)):path.resolve(path.dirname(full),id);if(target.endsWith('.json'))return JSON.parse(fs.readFileSync(target,'utf8'));if(!path.extname(target))target+='.ts';return load(target)}return require(id)};
  new Function('require','module','exports',code)(local,mod,mod.exports);return mod.exports;
 }
 return load;
};
