const path = require("node:path");
const { app, BrowserWindow, Menu, dialog, ipcMain, shell, session } = require("electron");
const { autoUpdater } = require("electron-updater");

const DEFAULT_APP_URL = "https://nexora-point-system.vercel.app";
const UPDATE_CHECK_INTERVAL_MS = 1000 * 60 * 60 * 4;

let mainWindow = null;
let updateDownloaded = false;

function resolveAppUrl() {
  const rawUrl = app.isPackaged
    ? process.env.NEXORA_APP_URL || DEFAULT_APP_URL
    : process.env.NEXORA_DEV_URL || "http://localhost:3000";

  try {
    return new URL(rawUrl).toString();
  } catch {
    return DEFAULT_APP_URL;
  }
}

function sendUpdateStatus(status, detail = {}) {
  if (!mainWindow || mainWindow.isDestroyed()) return;

  mainWindow.webContents.send("nexora:update", {
    status,
    detail,
    at: new Date().toISOString(),
  });
}

function buildOfflineHtml(appUrl) {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>NEXORA POINT</title>
    <style>
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        background: #050507;
        color: #fff;
        font-family: Arial, sans-serif;
      }
      main {
        width: min(420px, calc(100vw - 32px));
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 28px;
        padding: 28px;
        background: linear-gradient(180deg, rgba(255, 255, 255, 0.06), rgba(255, 255, 255, 0.02));
        box-shadow: 0 28px 90px rgba(0, 0, 0, 0.48);
      }
      h1 {
        margin: 0;
        font-size: 28px;
        letter-spacing: 0.08em;
      }
      p {
        color: rgba(255, 255, 255, 0.68);
        line-height: 1.7;
      }
      button {
        width: 100%;
        min-height: 48px;
        border: 0;
        border-radius: 18px;
        background: #facc15;
        color: #050507;
        font-weight: 900;
        cursor: pointer;
      }
      small {
        display: block;
        margin-top: 14px;
        color: rgba(255, 255, 255, 0.42);
        word-break: break-all;
      }
    </style>
  </head>
  <body>
    <main>
      <h1>NEXORA</h1>
      <p>Cannot connect to the NEXORA server right now. Check your internet connection and try again.</p>
      <button onclick="window.nexoraDesktop?.reloadApp()">RETRY</button>
      <small>${appUrl}</small>
    </main>
  </body>
</html>`;
}

async function loadAppUrl() {
  if (!mainWindow || mainWindow.isDestroyed()) return;

  const appUrl = resolveAppUrl();

  try {
    await mainWindow.loadURL(appUrl);
  } catch {
    await mainWindow.loadURL(
      `data:text/html;charset=utf-8,${encodeURIComponent(buildOfflineHtml(appUrl))}`
    );
  }
}

function createWindow() {
  const windowIconPath = app.isPackaged
    ? undefined
    : path.join(__dirname, "assets", "icon.ico");

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1024,
    minHeight: 680,
    title: "NEXORA POINT",
    backgroundColor: "#050507",
    ...(windowIconPath ? { icon: windowIconPath } : {}),
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.once("ready-to-show", () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    mainWindow.show();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.webContents.on("will-navigate", (event, url) => {
    try {
      const protocol = new URL(url).protocol;
      if (protocol === "http:" || protocol === "https:") return;
    } catch {
      event.preventDefault();
      return;
    }

    event.preventDefault();
    shell.openExternal(url);
  });

  mainWindow.webContents.on("did-fail-load", (_event, _code, _description, _url, isMainFrame) => {
    if (!isMainFrame) return;

    const appUrl = resolveAppUrl();
    void mainWindow?.loadURL(
      `data:text/html;charset=utf-8,${encodeURIComponent(buildOfflineHtml(appUrl))}`
    );
  });

  void loadAppUrl();
}

function configurePermissions() {
  const trustedOrigins = new Set([new URL(resolveAppUrl()).origin]);
  const allowedPermissions = new Set(["media", "notifications", "clipboard-read"]);

  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    try {
      const origin = new URL(webContents.getURL()).origin;
      callback(trustedOrigins.has(origin) && allowedPermissions.has(permission));
    } catch {
      callback(false);
    }
  });
}

function configureAutoUpdates() {
  if (!app.isPackaged) return;

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on("checking-for-update", () => sendUpdateStatus("checking"));
  autoUpdater.on("update-available", (info) => sendUpdateStatus("available", info));
  autoUpdater.on("update-not-available", (info) => sendUpdateStatus("not-available", info));
  autoUpdater.on("download-progress", (progress) => sendUpdateStatus("downloading", progress));
  autoUpdater.on("update-downloaded", (info) => {
    updateDownloaded = true;
    sendUpdateStatus("downloaded", info);
  });
  autoUpdater.on("error", (error) => {
    sendUpdateStatus("error", {
      message: error instanceof Error ? error.message : String(error),
    });
  });

  const checkForUpdates = () => {
    autoUpdater.checkForUpdates().catch((error) => {
      sendUpdateStatus("error", {
        message: error instanceof Error ? error.message : String(error),
      });
    });
  };

  setTimeout(checkForUpdates, 3000);
  setInterval(checkForUpdates, UPDATE_CHECK_INTERVAL_MS);
}

function registerIpcHandlers() {
  ipcMain.handle("nexora:get-version", () => app.getVersion());
  ipcMain.handle("nexora:reload-app", async () => {
    await loadAppUrl();
    return true;
  });
  ipcMain.handle("nexora:check-for-updates", async () => {
    if (!app.isPackaged) {
      return { skipped: true, reason: "updates-only-run-in-packaged-apps" };
    }

    return autoUpdater.checkForUpdates();
  });
  ipcMain.handle("nexora:install-update", () => {
    if (!updateDownloaded) {
      return { skipped: true, reason: "no-update-downloaded" };
    }

    autoUpdater.quitAndInstall(false, true);
    return { installing: true };
  });
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  configurePermissions();
  registerIpcHandlers();
  createWindow();
  configureAutoUpdates();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

process.on("uncaughtException", (error) => {
  dialog.showErrorBox(
    "NEXORA POINT",
    error instanceof Error ? error.message : String(error)
  );
});
