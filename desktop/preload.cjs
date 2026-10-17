const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("nexoraDesktop", {
  platform: process.platform,
  isDesktop: true,
  isGameDesktop: process.argv.includes('--nexora-game-only'),
  supportsNativeWindowModes: true,
  gameLogin: provider => ipcRenderer.invoke('nexora:game-login',provider),
  windowControl: action => ipcRenderer.invoke('nexora:window-control',action),
  getVersion: () => ipcRenderer.invoke("nexora:get-version"),
  reloadApp: () => ipcRenderer.invoke("nexora:reload-app"),
  checkForUpdates: () => ipcRenderer.invoke("nexora:check-for-updates"),
  installUpdate: () => ipcRenderer.invoke("nexora:install-update"),
  onUpdate: (callback) => {
    if (typeof callback !== "function") return () => {};

    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on("nexora:update", listener);

    return () => {
      ipcRenderer.removeListener("nexora:update", listener);
    };
  },
});
