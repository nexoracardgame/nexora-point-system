const base = require('../package.json').build;
const release=require('../public/game-release.json');
module.exports = {
  ...base, appId:'com.nexora.cardgame', productName:'NEXORA CARD GAME',
  // Npm versions disagree on the root dependency tree; ship the isolated desktop install explicitly.
  files:['main.cjs','preload.cjs','game-*.cjs','assets/**','package.json','!node_modules/**'],
  extraFiles:[{from:'desktop/node_modules',to:'resources/app/node_modules',filter:['**/*','!**/.bin/**','!**/.package-lock.json']}],
  extraResources:[...(base.extraResources||[]),{from:'public/game-release.json',to:'game-resources/game-release.json'},...release.resources.map(resource=>({from:'public'+resource.url,to:'game-resources'+resource.url}))],
  directories:{...base.directories,output:'dist/game-desktop'},
  extraMetadata:{name:'nexora-card-game',version:'1.0.14',gameOnly:true},
  win:{...base.win,icon:'desktop/assets/game-icon.ico'},
  artifactName:'NEXORA-CARD-GAME-Setup-${version}.${ext}',
  protocols:[{name:'NEXORA Game Login',schemes:['nexoragame']}],
  nsis:{...base.nsis,oneClick:false,allowToChangeInstallationDirectory:false,installerSidebar:'desktop/assets/game-setup/sidebar.bmp',uninstallerSidebar:'desktop/assets/game-setup/sidebar.bmp',installerIcon:'desktop/assets/game-icon.ico',uninstallerIcon:'desktop/assets/game-icon.ico',installerHeaderIcon:'desktop/assets/game-icon.ico',include:'desktop/assets/game-installer.nsh',shortcutName:'NEXORA CARD GAME',uninstallDisplayName:'NEXORA CARD GAME'},
  publish:[{provider:'generic',url:'https://nexora-point-system.vercel.app/downloads/game-windows/'}],
};
