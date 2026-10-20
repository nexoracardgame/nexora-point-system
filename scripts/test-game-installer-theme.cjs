const fs=require('node:fs'),assert=require('node:assert/strict'),sharp=require('sharp');
const config=require('../desktop/game-config.cjs');
(async()=>{
 assert.equal(config.nsis.oneClick,false);
 for(const key of ['installerSidebar','uninstallerSidebar']){
  const file=config.nsis[key];assert.equal(file,'desktop/assets/game-setup/sidebar.bmp');
  const bytes=fs.readFileSync(file);assert.equal(bytes.toString('ascii',0,2),'BM');assert.equal(bytes.readInt32LE(18),328);assert.equal(bytes.readInt32LE(22),628);
 }
 const skin=fs.readFileSync('desktop/assets/game-installer.nsh','utf8');
 assert.match(skin,/StrCpy \$0 \$mui\.FinishPage\.Run/);
 assert.match(skin,/SetWindowTheme\(p r0/);
 assert.match(skin,/SetCtlColors \$mui\.FinishPage\.Run FFFFFF 0B0A09/);
 assert.match(skin,/MUI_PAGE_CUSTOMFUNCTION_SHOW NexoraFinishShow/);
 assert.match(skin,/MUI_FINISHPAGE_RUN_FUNCTION NexoraStartApp/);
 for(const mode of ['install','uninstall'])for(let frame=0;frame<16;frame++)assert.ok(fs.statSync(`desktop/assets/game-setup/${mode}-${frame}.bmp`).size>1000);
 const metadata=await sharp('public/game-assets/installer/wallpaper.webp').metadata();assert.equal(metadata.width,1600);assert.equal(metadata.height,900);
 console.log('Installer theme: game artwork on both finish sidebars, explicit white checkbox text, launch callback and gold animation frames passed');
})().catch(error=>{console.error(error);process.exitCode=1});
