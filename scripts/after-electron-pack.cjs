const { execFileSync } = require("node:child_process");
const path = require("node:path");
const fs = require('node:fs');

exports.default = async function afterElectronPack(context) {
  if (context.electronPlatformName !== "win32") {
    return;
  }

  const rootDir = context.packager.projectDir;
  const exeName = `${context.packager.appInfo.productFilename}.exe`;
  const exePath = path.join(context.appOutDir, exeName);
  const game = context.packager.appInfo.productName === 'NEXORA CARD GAME';
  if(game){
    const appDir=path.join(context.appOutDir,'resources','app');
    const expected=require(path.join(rootDir,'desktop','package-lock.json')).packages;
    const moduleDir=path.join(appDir,'node_modules');
    if(!fs.existsSync(path.join(moduleDir,'electron-updater','package.json')))throw Error('Desktop runtime dependencies were not packaged');
    for(const entry of fs.readdirSync(moduleDir,{withFileTypes:true})){
      if(!entry.isDirectory()||entry.name.startsWith('.'))continue;
      const names=entry.name.startsWith('@')?fs.readdirSync(path.join(moduleDir,entry.name)).map(name=>entry.name+'/'+name):[entry.name];
      for(const name of names)if(!expected['node_modules/'+name])throw Error('Unexpected website dependency in desktop package: '+name);
    }
    let bytes=0;const walk=directory=>{for(const entry of fs.readdirSync(directory,{withFileTypes:true})){const file=path.join(directory,entry.name);if(entry.isDirectory())walk(file);else bytes+=fs.statSync(file).size}};walk(appDir);
    if(bytes>100*1024*1024)throw Error('Desktop runtime exceeds 100 MB; website dependencies may have leaked into the installer');
    console.log('Verified isolated desktop runtime: '+Math.ceil(bytes/1048576)+' MB');
  }
  const iconPath = path.join(rootDir, "desktop", "assets", game ? "game-icon.ico" : "icon.ico");
  const rceditPath = path.join(
    rootDir,
    "node_modules",
    "electron-winstaller",
    "vendor",
    "rcedit.exe"
  );

  execFileSync(
    rceditPath,
    [
      exePath,
      "--set-icon",
      iconPath,
      "--set-version-string",
      "FileDescription",
      context.packager.appInfo.productName,
      "--set-version-string",
      "ProductName",
      context.packager.appInfo.productName,
      "--set-version-string",
      "CompanyName",
      "NEXORA",
      "--set-version-string",
      "LegalCopyright",
      context.packager.appInfo.copyright,
      "--set-file-version",
      context.packager.appInfo.version,
      "--set-product-version",
      context.packager.appInfo.version,
    ],
    { stdio: "inherit" }
  );
};
