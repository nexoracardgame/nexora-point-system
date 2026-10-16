const fs=require('node:fs'),vm=require('node:vm');
// Run the existing game workflows inside the actual isolated platform shell.
let test=fs.readFileSync('scripts/test-triad-command-ui.cjs','utf8');
const modules=`
modules['game-shell']=transpile(fs.readFileSync('components/GameShell.tsx','utf8'));
modules['./BattleHud.css']='';modules['./GameShell.css']='';
modules['next/dynamic']='exports.__esModule=true;exports.default=()=>()=>null;';
modules['next/navigation']='exports.usePathname=()=>"/game";';
modules['@/lib/battle-ui-state']='exports.useBattleArenaActive=()=>false;';
modules['@/components/OnlinePresenceProvider']='exports.OnlinePresenceProvider=({children})=>children;';
modules['room-actions']=transpile(fs.readFileSync('components/BattleRoomActions.tsx','utf8'));modules['./BattleRoomActions.css']='';
`;
test=test.replace('const bundle=',modules+'\nconst bundle=')
 .replace('modules.test=transpile(`','modules.test=transpile(`import BattleRoomActions from "room-actions";')
 .replace("const css=fs.readFileSync(","const css=fs.readFileSync('components/GameShell.css','utf8')+'\\n'+fs.readFileSync(")
 .replace('id="root" class="nexora-battle-shell"','id="root"')
 .replace('root.render(React.createElement(React.Fragment,null,','root.render(React.createElement(require(\'game-shell\').default,null,')
 .replaceAll("root.render(React.createElement(require('test').TestDeck))","root.render(React.createElement(require('game-shell').default,null,React.createElement(require('test').TestDeck)))")
 .replace("page.on('pageerror',e=>errors.push(e.message));","page.on('pageerror',e=>{errors.push(e.message);console.error(e.message)});");
vm.runInThisContext(`(function(require,module,exports){${test}\n})`,{filename:'scripts/test-game-shell-ui.cjs'})(require,module,exports);
