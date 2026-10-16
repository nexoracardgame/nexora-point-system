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
modules['@/lib/game-patcher']+=';exports.hasPendingGameResources=async()=>true;';
modules['@/lib/battle-ui-state']='exports.useBattleArenaActive=()=>false;';
modules['@/components/OnlinePresenceProvider']='exports.OnlinePresenceProvider=({children})=>children;';
modules['room-actions']=transpile(fs.readFileSync('components/BattleRoomActions.tsx','utf8'));modules['./BattleRoomActions.css']='';
`;
test=test.replace('const bundle=',modules+'\nconst bundle=')
 .replace("const url=new URL(route.request().url());","const url=new URL(route.request().url());if(url.pathname==='/game-release.json')return route.fulfill({json:{version:'test',resources:[]}});if(url.pathname==='/api/game-wallet')return route.fulfill({json:{coin:167476,nexPoint:867}});")
 .replace("const css=fs.readFileSync(","const css=fs.readFileSync('components/GameLobbyWallet.css','utf8')+'\\n'+fs.readFileSync(")
 .replace('const url=new URL(route.request().url());',"const url=new URL(route.request().url());if(url.pathname==='/api/game-profile')return route.fulfill({json:{avatar:'',frame:'gold',hero:'gold'}});")
 .replace('[[3840,2160],[2560,1440],[1920,1080],[1440,900],[1280,720],[1024,768],[844,390],[667,375],[390,844],[320,568]]',process.env.SMALL_ONLY==='1'?'[[320,568]]':'[[3840,2160],[2560,1440],[1920,1080],[1440,900],[1280,720],[1024,768],[844,390],[667,375],[390,844],[320,568]]')
 .replace("await page.screenshot({path:'artifacts/triad-command/lobby-'+width+'.png'});",`await page.locator('.nexora-command-nav .nexora-menu-logout').waitFor();
 const logout=page.locator('.nexora-menu-logout');const logoutBox=await logout.boundingBox();assert.ok(logoutBox&&logoutBox.x>=0&&logoutBox.y>=0&&logoutBox.x+logoutBox.width<=width+1&&logoutBox.y+logoutBox.height<=height+1,'Logout fits '+width);
 assert.equal(await logout.evaluate(el=>{const r=el.getBoundingClientRect();return el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))}),true,'Logout is not covered '+width+' '+JSON.stringify(await logout.evaluate(el=>{const r=el.getBoundingClientRect(),p=el.parentElement;return {rect:r.toJSON(),parent:p.getBoundingClientRect().toJSON(),max:getComputedStyle(p).maxHeight,hit:document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.outerHTML.slice(0,200)}})));
 assert.equal(await page.locator('.nexora-window-controls [aria-label="ออกจากระบบ"]').count(),0);
 const beforeMenu=page.url();await page.getByRole('button',{name:'การ์ดของฉัน',exact:true}).click();await page.getByRole('status').filter({hasText:'การ์ดของฉัน · ยังไม่เปิดให้บริการ'}).waitFor();assert.equal(page.url(),beforeMenu);
 await page.getByRole('button',{name:'เพื่อน',exact:true}).click();await page.getByRole('status').filter({hasText:'เพื่อน · ยังไม่เปิดให้บริการ'}).waitFor();assert.equal(page.url(),beforeMenu);
 assert.equal(await page.getByRole('button',{name:'หน้าหลักเกม',exact:true}).count(),0);assert.equal(await page.getByRole('button',{name:'อันดับนักดวล',exact:true}).count(),0);assert.equal(await page.getByRole('button',{name:'เว็บหลัก',exact:true}).count(),0);
 for(const button of await page.locator('.nexora-command-nav > button').all()){await button.hover();await page.waitForTimeout(160);assert.equal(await button.evaluate(el=>getComputedStyle(el).transform),'none','Menu hover stays in place');}
 const menuMetrics=await page.locator('.nexora-command-nav').evaluate(el=>({width:el.clientWidth,scroll:el.scrollWidth,bar:getComputedStyle(el).scrollbarWidth}));assert.ok(menuMetrics.scroll<=menuMetrics.width,'No horizontal overflow');assert.equal(menuMetrics.bar,'none','No visible scrollbar');
 for(const control of await page.locator('.nexora-lobby-wallet button').all()){const r=await control.boundingBox();assert.ok(r&&r.x>=0&&r.y>=0&&r.x+r.width<=width&&r.y+r.height<=height,'Wallet fits '+width);assert.equal(await control.evaluate(el=>{const r=el.getBoundingClientRect();return el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))}),true,'Wallet hit target '+width);}
 await page.getByRole('button',{name:'ดูยอด COIN',exact:true}).click();await page.getByRole('dialog',{name:'กระเป๋าเงินเกม',exact:true}).waitFor();await page.getByRole('button',{name:'ปิด',exact:true}).click();
 await page.getByRole('button',{name:'ดาวน์โหลดทรัพยากรเกม',exact:true}).click();await page.getByRole('dialog',{name:'ทรัพยากรเกม',exact:true}).waitFor();await page.keyboard.press('Escape');await page.getByRole('dialog').waitFor({state:'detached'});
 await page.screenshot({path:'artifacts/triad-command/lobby-'+width+'.png'});`)
 .replace('modules.test=transpile(`','modules.test=transpile(`import BattleRoomActions from "room-actions";')
 .replace("const css=fs.readFileSync(","const css=fs.readFileSync('components/GameShell.css','utf8')+'\\n'+fs.readFileSync(")
 .replace("fs.readFileSync('components/LobbyBanner.css','utf8');","fs.readFileSync('components/LobbyBanner.css','utf8')+'\\n'+fs.readFileSync('components/GameWindowControls.css','utf8');")
 .replace('id="root" class="nexora-battle-shell"','id="root"')
 .replace('root.render(React.createElement(React.Fragment,null,','root.render(React.createElement(require(\'game-shell\').default,null,')
 .replaceAll("root.render(React.createElement(require('test').TestDeck))","root.render(React.createElement(require('game-shell').default,null,React.createElement(require('test').TestDeck)))")
 .replace("page.on('pageerror',e=>errors.push(e.message));","page.on('pageerror',e=>{errors.push(e.message);console.error(e.message)});");
vm.runInThisContext(`(function(require,module,exports){${test}\n})`,{filename:'scripts/test-game-shell-ui.cjs'})(require,module,exports);
