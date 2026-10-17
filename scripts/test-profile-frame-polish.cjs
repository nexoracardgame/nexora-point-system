const fs=require('node:fs'),vm=require('node:vm');
let source=fs.readFileSync('scripts/test-player-profile-ui.cjs','utf8');
source=source.replace("modules['./GamePlayerProfile.css']='';","modules['./GamePlayerProfile.css']='';modules['./GameProfileFrame.css']='';");
source=source.replace("${fs.readFileSync('components/GamePlayerProfile.css','utf8')}","${fs.readFileSync('components/GamePlayerProfile.css','utf8')}${fs.readFileSync('components/GameProfileFrame.css','utf8')}");
source=source.replace("await page.getByRole('button',{name:'เปลี่ยนกรอบ',exact:true}).click();",`const geometry=await page.locator('.gpp-framed-rank').evaluate(el=>{const r=el.getBoundingClientRect(),s=el.querySelector('span').getBoundingClientRect(),rotated=window.innerWidth<window.innerHeight;return {ratio:rotated?r.height/r.width:r.width/r.height,offset:rotated?Math.abs(s.x+s.width/2-(r.right-r.width*.495)):Math.abs(s.y+s.height/2-(r.y+r.height*.495))}});assert.ok(Math.abs(geometry.ratio-835/230)<.03,'Rank artwork keeps original aspect');assert.ok(geometry.offset<2,'Rank text centered');await page.getByRole('button',{name:'เปลี่ยนกรอบ',exact:true}).click();`);
source=source.replaceAll('*.495','*.4');
vm.runInThisContext(`(function(require,module,exports){${source}\n})`,{filename:__filename})(require,module,exports);
