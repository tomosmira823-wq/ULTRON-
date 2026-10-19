const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('kivo', {
  min: () => ipcRenderer.send('win:min'),
  max: () => ipcRenderer.send('win:max'),
  close: () => ipcRenderer.send('win:close'),
  onWinState: (fn) => ipcRenderer.on('win:state', (_e, v) => fn(v)),
  load: () => ipcRenderer.invoke('data:load'),
  save: (d) => ipcRenderer.invoke('data:save', d),
  keyStatus: () => ipcRenderer.invoke('keys:status'),
  setKeys: (p) => ipcRenderer.invoke('keys:set', p),
  ask: (o) => ipcRenderer.invoke('claude:ask', o),
  printify: (o) => ipcRenderer.invoke('printify:req', o),
  saveFile: (o) => ipcRenderer.invoke('file:save', o),
  saveDir: (o) => ipcRenderer.invoke('file:saveDir', o),
  onUpdate: (fn) => ipcRenderer.on('update:state', (_e, v) => fn(v)),
  installUpdate: () => ipcRenderer.send('update:install'),
  version: () => ipcRenderer.invoke('app:version'),
  openUrl: (u) => ipcRenderer.send('open:url', u),
});
