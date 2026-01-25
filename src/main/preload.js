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
  onClaudeOperation: (callback) => ipcRenderer.on('claude-operation', (event, data) => callback(data)),
  getRecentProjects: () => ipcRenderer.invoke('get-recent-projects'),
  addRecentProject: (projectPath) => ipcRenderer.invoke('add-recent-project', projectPath),
  getGitStatus: (projectPath) => ipcRenderer.invoke('get-git-status', projectPath),
  getGitBranch: (projectPath) => ipcRenderer.invoke('get-git-branch', projectPath),
  getGitCommits: (projectPath, limit) => ipcRenderer.invoke('get-git-commits', projectPath, limit),
  getGitDiff: (projectPath, filePath) => ipcRenderer.invoke('get-git-diff', projectPath, filePath),
  openExternal: (url) => ipcRenderer.invoke('open-external', url)
});
