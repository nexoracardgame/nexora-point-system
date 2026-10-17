const fs=require('node:fs'),vm=require('node:vm');
// Exercise browser image dragging, not just a text-only card button.
let source=fs.readFileSync('scripts/test-card-mouse-sweep.cjs','utf8');
source=source.replace("},id)}", "},React.createElement('img',{src:'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22100%22 height=%22150%22%3E%3Crect width=%22100%22 height=%22150%22 fill=%22gold%22/%3E%3C/svg%3E',style:{width:100,height:150}}))}");
if(!source.includes('data:image/svg+xml'))throw Error('Missing card fixture anchor');
source=source.replace("await page.mouse.down();await page.waitForTimeout(280);", "await page.mouse.down();await page.mouse.move(85,90,{steps:12});await page.waitForTimeout(280);");
vm.runInThisContext(`(function(require,module,exports){${source}\n})`,{filename:__filename})(require,module,exports);
