const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const chokidar = require('chokidar');
const Store = require('electron-store');
const { parseRoadmap } = require('./parsers/roadmap-parser');
const { parseRequirements } = require('./parsers/requirements-parser');
const { parseDirectory, flattenTree } = require('./parsers/directory-parser');
const { parseState } = require('./parsers/state-parser');

const store = new Store();
let mainWindow;
let watcher = null;

function createWindow() {
  // Restore window state from previous session
  const windowState = store.get('windowState', {
    width: 1200,
    height: 800
  });

  mainWindow = new BrowserWindow({
    width: windowState.width,
    height: windowState.height,
    x: windowState.x,
    y: windowState.y,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  // Save window state on close
  mainWindow.on('close', () => {
    const bounds = mainWindow.getBounds();
    store.set('windowState', bounds);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    stopWatching();
  });
}

// File watcher functions
function startWatching(projectPath) {
  stopWatching();

  const planningPath = path.join(projectPath, '.planning');
  watcher = chokidar.watch(planningPath, {
    ignoreInitial: true,
    persistent: true,
    ignored: /(^|[\/\\])\../ // Ignore dotfiles
  });

  let debounceTimer = null;

  watcher.on('all', (event, filePath) => {
    // Debounce to avoid rapid updates
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('files-changed', { event, path: filePath });
      }
    }, 500);
  });
}

function stopWatching() {
  if (watcher) {
    watcher.close();
    watcher = null;
  }
}

app.whenReady().then(() => {
  createWindow();

  // IPC handler for folder selection
  ipcMain.handle('select-folder', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
      title: 'Select GSD Project Folder'
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    return result.filePaths[0];
  });

  // IPC handler for parsing roadmap
  ipcMain.handle('parse-roadmap', async (event, planningPath) => {
    try {
      return parseRoadmap(planningPath);
    } catch (error) {
      console.error('Error parsing roadmap:', error);
      return { error: error.message, phases: [] };
    }
  });

  // IPC handler for parsing requirements
  ipcMain.handle('parse-requirements', async (event, planningPath) => {
    try {
      return parseRequirements(planningPath);
    } catch (error) {
      console.error('Error parsing requirements:', error);
      return { error: error.message, requirements: [], phaseMapping: {} };
    }
  });

  // IPC handler for parsing directory structure
  ipcMain.handle('parse-directory', async (event, planningPath) => {
    try {
      const result = parseDirectory(planningPath);
      const flattened = flattenTree(result.tree);
      return { ...result, ...flattened };
    } catch (error) {
      console.error('Error parsing directory:', error);
      return { error: error.message, tree: null, files: [], nodes: [], links: [] };
    }
  });

  // IPC handler for parsing all GSD data at once
  ipcMain.handle('parse-project', async (event, projectPath) => {
    try {
      const planningPath = path.join(projectPath, '.planning');

      const roadmap = parseRoadmap(planningPath);
      const requirements = parseRequirements(planningPath);
      const directory = parseDirectory(planningPath);
      const dirFlattened = flattenTree(directory.tree);
      const state = parseState(planningPath);

      return {
        roadmap,
        requirements,
        directory: { ...directory, ...dirFlattened },
        state,
        projectPath
      };
    } catch (error) {
      console.error('Error parsing project:', error);
      return { error: error.message };
    }
  });

  // IPC handler for opening files in external editor
  ipcMain.handle('open-file', async (event, filePath) => {
    try {
      const result = await shell.openPath(filePath);
      if (result) {
        // shell.openPath returns empty string on success, error message on failure
        return { error: result };
      }
      return { success: true };
    } catch (error) {
      console.error('Error opening file:', error);
      return { error: error.message };
    }
  });

  // IPC handler for starting file watcher
  ipcMain.handle('start-watching', async (event, projectPath) => {
    startWatching(projectPath);
    return { success: true };
  });

  // IPC handler for stopping file watcher
  ipcMain.handle('stop-watching', async () => {
    stopWatching();
    return { success: true };
  });

  // IPC handler for getting recent projects
  ipcMain.handle('get-recent-projects', async () => {
    return store.get('recentProjects', []);
  });

  // IPC handler for adding to recent projects
  ipcMain.handle('add-recent-project', async (event, projectPath) => {
    let recent = store.get('recentProjects', []);
    // Remove if already exists (to move to front)
    recent = recent.filter(p => p !== projectPath);
    // Add to front
    recent.unshift(projectPath);
    // Keep only last 5
    recent = recent.slice(0, 5);
    store.set('recentProjects', recent);
    return recent;
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  app.quit();
});
