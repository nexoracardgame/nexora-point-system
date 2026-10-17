const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
let source=fs.readFileSync('scripts/test-player-profile-ui.cjs','utf8');
const logo=ts.transpileModule(fs.readFileSync('components/GamePageLogo.tsx','utf8'),{compilerOptions:{module:1,jsx:4,target:7}}).outputText;
source=source.replace("modules['./GamePlayerProfile.css']='';",`modules['./GamePlayerProfile.css']='';modules['./GameProfileFrame.css']='';modules['./GamePageLogo.css']='';modules['./GamePageLogo']=${JSON.stringify(logo)};`);
source=source.replace("${fs.readFileSync('components/GamePlayerProfile.css','utf8')}","${fs.readFileSync('components/GamePlayerProfile.css','utf8')}${fs.readFileSync('components/GameProfileFrame.css','utf8')}${fs.readFileSync('components/GamePageLogo.css','utf8')}");
source=source.replace("await page.getByRole('button',{name:'เปลี่ยนกรอบ',exact:true}).click();",`const logo=await page.locator('.nexora-page-logo').evaluate(el=>({x:el.offsetLeft,y:el.offsetTop,width:el.clientWidth,parent:el.parentElement.clientWidth}));assert.ok(Math.abs(logo.x-logo.parent*.03)<2,'Shared logo left alignment');await page.getByRole('button',{name:'เปลี่ยนกรอบ',exact:true}).click();`);
vm.runInThisContext(`(function(require,module,exports){${source}\n})`,{filename:__filename})(require,module,exports);
