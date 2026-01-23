const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  parseRoadmap: (planningPath) => ipcRenderer.invoke('parse-roadmap', planningPath),
  parseRequirements: (planningPath) => ipcRenderer.invoke('parse-requirements', planningPath),
  parseDirectory: (planningPath) => ipcRenderer.invoke('parse-directory', planningPath),
  parseProject: (projectPath) => ipcRenderer.invoke('parse-project', projectPath)
});
