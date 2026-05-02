const { execFileSync } = require("node:child_process");
const path = require("node:path");

exports.default = async function afterElectronPack(context) {
  if (context.electronPlatformName !== "win32") {
    return;
  }

  const rootDir = context.packager.projectDir;
  const exeName = `${context.packager.appInfo.productFilename}.exe`;
  const exePath = path.join(context.appOutDir, exeName);
  const iconPath = path.join(rootDir, "desktop", "assets", "icon.ico");
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
