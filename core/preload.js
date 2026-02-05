// preload.js
const { contextBridge, ipcRenderer } = require('electron');

console.log("Preload.js loaded");

contextBridge.exposeInMainWorld('api', {
  getProfiles: () => ipcRenderer.invoke('get-profiles'),
  getConfig: () => ipcRenderer.invoke('get-config'),
  saveConfig: (config) => ipcRenderer.invoke('save-config', config),
  getStatus: () => ipcRenderer.invoke('get-status'),
  restartEngine: () => ipcRenderer.invoke('restart-engine'),
  autostartEnable: () => ipcRenderer.invoke('autostart-enable'),
  autostartDisable: () => ipcRenderer.invoke('autostart-disable'),
  autostartStatus: () => ipcRenderer.invoke('autostart-status'),
  // NEW: Window Control Triggers
  minimize: () => ipcRenderer.send('window-minimize'),
  hide: () => ipcRenderer.send('window-hide'),
  onLog: (callback) => {
        // We remove existing listeners to prevent memory leaks/duplicate logs
        ipcRenderer.removeAllListeners('engine-log');
        
        // Listen for the 'engine-log' event and pass the data to React
        ipcRenderer.on('engine-log', (event, data) => callback(data));
    },
});
