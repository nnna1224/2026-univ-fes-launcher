const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('launcher', {
  status: (id) => ipcRenderer.invoke('launcher:status', id),
  download: (id) => ipcRenderer.invoke('launcher:download', id),
  downloadAll: () => ipcRenderer.invoke('launcher:download-all'),
  play: (id) => ipcRenderer.invoke('launcher:play', id),
  onProgress: (callback) => ipcRenderer.on('launcher:progress', (_event, id, message) => callback(id, message)),
});
