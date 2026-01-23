const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  parseRoadmap: (planningPath) => ipcRenderer.invoke('parse-roadmap', planningPath),
  parseRequirements: (planningPath) => ipcRenderer.invoke('parse-requirements', planningPath),
  parseDirectory: (planningPath) => ipcRenderer.invoke('parse-directory', planningPath),
  parseProject: (projectPath) => ipcRenderer.invoke('parse-project', projectPath),
  openFile: (filePath) => ipcRenderer.invoke('open-file', filePath),
  readFileContent: (filePath) => ipcRenderer.invoke('read-file-content', filePath),
  getFileStats: (filePath) => ipcRenderer.invoke('get-file-stats', filePath),
  startWatching: (projectPath) => ipcRenderer.invoke('start-watching', projectPath),
  stopWatching: () => ipcRenderer.invoke('stop-watching'),
  onFilesChanged: (callback) => ipcRenderer.on('files-changed', (event, data) => callback(data)),
  getRecentProjects: () => ipcRenderer.invoke('get-recent-projects'),
  addRecentProject: (projectPath) => ipcRenderer.invoke('add-recent-project', projectPath)
});
