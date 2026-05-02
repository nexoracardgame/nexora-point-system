const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("nexoraDesktop", {
  platform: process.platform,
  isDesktop: true,
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
