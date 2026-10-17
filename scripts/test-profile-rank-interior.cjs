const fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('scripts/test-lobby-frame-polish.cjs','utf8').replaceAll('*.495','*.4');
vm.runInThisContext(`(function(require,module,exports){${source}\n})`,{filename:__filename})(require,module,exports);
