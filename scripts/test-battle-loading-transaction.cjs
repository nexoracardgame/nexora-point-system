const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ts = require('typescript');
let now = 0;
let deadline = 0;
const moduleObject = { exports: {} };
const context = vm.createContext({
  exports: moduleObject.exports,
  require: () => ({}),
  performance: { now: () => now },
  Event: class {},
  window: { dispatchEvent: () => { deadline = vm.runInContext('until', context); } },
});
vm.runInContext(ts.transpileModule(fs.readFileSync('components/BattleLoadingScreen.tsx', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText, context);
const begin = moduleObject.exports.beginBattleLoading;
begin();
assert.equal(deadline, 3000);
now = 3500;
begin('arrival');
assert.equal(deadline, 3000, 'Slow room response must not start a second loading screen');
now = 3550;
begin('arrival');
assert.equal(deadline, 3000, 'Pathname and room stage arrivals are one transition');
now = 8000;
begin('arrival');
assert.equal(deadline, 11000, 'Automatic return without a click still loads');
console.log('Loading transaction: slow arrival, duplicate stage, automatic return passed');
