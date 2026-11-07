const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('launcher', {
  status: (id) => ipcRenderer.invoke('launcher:status', id),
  download: (id) => ipcRenderer.invoke('launcher:download', id),
  downloadAll: () => ipcRenderer.invoke('launcher:download-all'),
  play: (id) => ipcRenderer.invoke('launcher:play', id),
  checkManifest: (url) => ipcRenderer.invoke('launcher:check-manifest', url),
  saveManifest: (url) => ipcRenderer.invoke('launcher:save-manifest', url),
  closeSetup: () => ipcRenderer.invoke('launcher:close-setup'),
  onProgress: (callback) => ipcRenderer.on('launcher:progress', (_event, id, message) => callback(id, message)),
});
