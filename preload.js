const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  startPty: (options) => ipcRenderer.invoke('start-pty', options),
  writePty: (data) => ipcRenderer.send('pty-write', data),
  resizePty: (size) => ipcRenderer.send('pty-resize', size),
  onPtyData: (cb) => ipcRenderer.on('pty-data', (e, data) => cb(data)),
  onPtyExit: (cb) => ipcRenderer.on('pty-exit', (e, code) => cb(code)),
  selectDirectory: () => ipcRenderer.invoke('select-directory'),
  getConfig: () => ipcRenderer.invoke('get-config'),
  saveConfig: (partial) => ipcRenderer.invoke('save-config', partial),
  setTitle: (title) => ipcRenderer.send('set-title', title),
});
