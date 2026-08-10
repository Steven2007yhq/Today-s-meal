const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('mealDesktop', {
  chat: (payload) => ipcRenderer.invoke('ai:chat', payload),
  getAiConfig: () => ipcRenderer.invoke('ai:get-config'),
  testAiConfig: () => ipcRenderer.invoke('ai:test'),
  openReadme: () => ipcRenderer.invoke('app:open-readme'),
  exportPdf: (payload) => ipcRenderer.invoke('pdf:export', payload),
  platform: process.platform,
})
