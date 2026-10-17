const base = require('../package.json').build;
module.exports = {
  ...base, appId:'com.nexora.cardgame', productName:'NEXORA CARD GAME',
  directories:{...base.directories,output:'dist/game-desktop'},
  extraMetadata:{name:'nexora-card-game',version:'1.0.5',gameOnly:true},
  win:{...base.win,icon:'desktop/assets/game-icon.ico'},
  artifactName:'NEXORA-CARD-GAME-Setup-${version}.${ext}',
  protocols:[{name:'NEXORA Game Login',schemes:['nexoragame']}],
  nsis:{...base.nsis,installerIcon:'desktop/assets/game-icon.ico',uninstallerIcon:'desktop/assets/game-icon.ico',installerHeaderIcon:'desktop/assets/game-icon.ico',include:'desktop/assets/game-installer.nsh',shortcutName:'NEXORA CARD GAME',uninstallDisplayName:'NEXORA CARD GAME'},
  publish:[{provider:'generic',url:'https://nexora-point-system.vercel.app/downloads/game-windows/'}],
};
