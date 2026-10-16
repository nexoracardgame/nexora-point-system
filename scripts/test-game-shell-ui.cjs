const fs=require('node:fs'),vm=require('node:vm');
// Run the existing game workflows inside the actual isolated platform shell.
let test=fs.readFileSync('scripts/test-triad-command-ui.cjs','utf8');
const modules=`
modules['game-shell']=transpile(fs.readFileSync('components/GameShell.tsx','utf8'));
modules['./BattleHud.css']='';modules['./GameShell.css']='';
modules['./GamePatchGate']='exports.__esModule=true;exports.default=({children})=>children;';
modules['./GameWindowControls']=transpile(fs.readFileSync('components/GameWindowControls.tsx','utf8'));
modules['./GameWindowControls.css']='';
modules['next-auth/react']='exports.useSession=()=>({status:"authenticated"});exports.signOut=async()=>{};';
modules['next/dynamic']='exports.__esModule=true;exports.default=()=>()=>null;';
modules['next/navigation']='exports.usePathname=()=>"/game";';
modules['@/lib/battle-ui-state']='exports.useBattleArenaActive=()=>false;';
modules['@/components/OnlinePresenceProvider']='exports.OnlinePresenceProvider=({children})=>children;';
modules['room-actions']=transpile(fs.readFileSync('components/BattleRoomActions.tsx','utf8'));modules['./BattleRoomActions.css']='';
`;
test=test.replace('const bundle=',modules+'\nconst bundle=')
 .replace("await page.screenshot({path:'artifacts/triad-command/lobby-'+width+'.png'});",`await page.locator('.nexora-command-nav .nexora-menu-logout').waitFor();
 const logout=page.locator('.nexora-menu-logout');const logoutBox=await logout.boundingBox();assert.ok(logoutBox&&logoutBox.x>=0&&logoutBox.y>=0&&logoutBox.x+logoutBox.width<=width+1&&logoutBox.y+logoutBox.height<=height+1,'Logout fits '+width);
 assert.equal(await logout.evaluate(el=>{const r=el.getBoundingClientRect();return el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))}),true,'Logout is not covered '+width);
 assert.equal(await page.locator('.nexora-window-controls [aria-label="ออกจากระบบ"]').count(),0);
 await page.screenshot({path:'artifacts/triad-command/lobby-'+width+'.png'});`)
 .replace('modules.test=transpile(`','modules.test=transpile(`import BattleRoomActions from "room-actions";')
 .replace("const css=fs.readFileSync(","const css=fs.readFileSync('components/GameWindowControls.css','utf8')+'\\n'+fs.readFileSync('components/GameShell.css','utf8')+'\\n'+fs.readFileSync(")
 .replace('id="root" class="nexora-battle-shell"','id="root"')
 .replace('root.render(React.createElement(React.Fragment,null,','root.render(React.createElement(require(\'game-shell\').default,null,')
 .replaceAll("root.render(React.createElement(require('test').TestDeck))","root.render(React.createElement(require('game-shell').default,null,React.createElement(require('test').TestDeck)))")
 .replace("page.on('pageerror',e=>errors.push(e.message));","page.on('pageerror',e=>{errors.push(e.message);console.error(e.message)});");
vm.runInThisContext(`(function(require,module,exports){${test}\n})`,{filename:'scripts/test-game-shell-ui.cjs'})(require,module,exports);
