const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
const chokidar = require('chokidar');
const Store = require('electron-store');
const { parseRoadmap } = require('./parsers/roadmap-parser');
const { parseRequirements } = require('./parsers/requirements-parser');
const { parseDirectory, parseDirectories, flattenTree, DEFAULT_SRC_IGNORE_PATTERNS } = require('./parsers/directory-parser');
const { parseState } = require('./parsers/state-parser');

const store = new Store();
let mainWindow;
let watcher = null;
let claudeEventWatcher = null;
const recentEvents = new Map(); // For deduplication: file_path -> timestamp
const eventQueue = [];          // Serial processing queue
let isProcessingQueue = false;  // Queue lock
const DEDUP_WINDOW_MS = 200;    // Timestamp window for deduplication

// Git helper function - runs git commands in specified directory
function runGitCommand(command, cwd) {
  try {
    return execSync(command, { cwd, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch (err) {
    return null;
  }
}

function createWindow() {
  // Restore window state from previous session
  const windowState = store.get('windowState', {
    width: 1200,
    height: 800
  });

  mainWindow = new BrowserWindow({
    width: windowState.width || 1200,
    height: windowState.height || 800,
    show: true,
    center: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  // Open DevTools for debugging
  mainWindow.webContents.openDevTools();

  // Log renderer errors
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('Failed to load:', errorCode, errorDescription);
  });

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
  const srcPath = path.join(projectPath, 'src');

  // Build array of paths to watch (only existing directories)
  const watchPaths = [];
  if (fs.existsSync(planningPath)) watchPaths.push(planningPath);
  if (fs.existsSync(srcPath)) watchPaths.push(srcPath);

  // Handle case where neither directory exists
  if (watchPaths.length === 0) {
    console.log('[Watcher] No directories to watch (.planning/ and src/ not found)');
    return;
  }

  console.log('[Watcher] Watching directories:', watchPaths);

  watcher = chokidar.watch(watchPaths, {
    ignoreInitial: true,
    persistent: true,
    depth: 10,
    ignored: [
      '**/node_modules/**',
      '**/.git/**',
      '**/dist/**',
      '**/build/**',
      '**/coverage/**',
      '**/.next/**',
      '**/.cache/**',
      '**/__pycache__/**'
    ]
  });

  let debounceTimer = null;

  watcher.on('all', (event, filePath) => {
    // Determine sourceType from path
    let sourceType = 'unknown';
    if (filePath.includes('/.planning/') || filePath.includes('\\.planning\\') || filePath.includes(path.sep + '.planning' + path.sep)) {
      sourceType = 'planning';
    } else if (filePath.includes('/src/') || filePath.includes('\\src\\') || filePath.includes(path.sep + 'src' + path.sep)) {
      sourceType = 'src';
    }

    console.log('[Watcher] Event:', event, filePath, 'sourceType:', sourceType);

    // Debounce to avoid rapid updates
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('files-changed', { event, path: filePath, sourceType });
      }
    }, 500);
  });

  // Start Claude event watcher
  startClaudeEventWatcher(projectPath);
}

function stopWatching() {
  if (watcher) {
    watcher.close();
    watcher = null;
  }
  stopClaudeEventWatcher();
}

// Claude event watcher functions
function startClaudeEventWatcher(projectPath) {
  stopClaudeEventWatcher();

  const eventsPath = path.join(projectPath, '.gsd-viewer', 'events');

  // Check if events directory exists
  if (!fs.existsSync(eventsPath)) {
    console.log('[ClaudeEvents] Events directory not found:', eventsPath);
    return;
  }

  console.log('[ClaudeEvents] Watching:', eventsPath);

  claudeEventWatcher = chokidar.watch(eventsPath, {
    ignoreInitial: true,
    persistent: true,
    depth: 0
  });

  claudeEventWatcher.on('add', (filePath) => {
    handleClaudeEvent(filePath);
  });
}

function stopClaudeEventWatcher() {
  if (claudeEventWatcher) {
    claudeEventWatcher.close();
    claudeEventWatcher = null;
  }
  recentEvents.clear();
  eventQueue.length = 0;
  isProcessingQueue = false;
}

async function handleClaudeEvent(eventFilePath) {
  try {
    // 1. Parse event file
    const content = fs.readFileSync(eventFilePath, 'utf-8');
    const event = JSON.parse(content);

    // 2. Validate required fields
    if (!event.file_path || !event.operation || !event.timestamp) {
      console.error('[ClaudeEvents] Invalid event - missing fields:', eventFilePath);
      fs.unlinkSync(eventFilePath); // Cleanup invalid file
      return;
    }

    // 3. Deduplication check
    const lastTimestamp = recentEvents.get(event.file_path);
    if (lastTimestamp && (event.timestamp - lastTimestamp) < DEDUP_WINDOW_MS) {
      console.log('[ClaudeEvents] Duplicate ignored:', event.file_path);
      fs.unlinkSync(eventFilePath); // Cleanup duplicate
      return;
    }
    recentEvents.set(event.file_path, event.timestamp);

    // 4. Clean up old entries from recentEvents (prevent memory leak)
    const cutoff = Date.now() - 60000; // 1 minute
    for (const [path, ts] of recentEvents.entries()) {
      if (ts < cutoff) recentEvents.delete(path);
    }

    // 5. Add to queue for serial processing
    eventQueue.push({ event, eventFilePath });
    processEventQueue();

  } catch (err) {
    console.error('[ClaudeEvents] Error processing event:', err.message);
    // Still try to cleanup the file
    try { fs.unlinkSync(eventFilePath); } catch (e) {}
  }
}

async function processEventQueue() {
  if (isProcessingQueue || eventQueue.length === 0) return;

  isProcessingQueue = true;

  while (eventQueue.length > 0) {
    const { event, eventFilePath } = eventQueue.shift();

    // Enrich with node ID
    const enrichedEvent = enrichEventWithNodeId(event);

    // Forward to renderer
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('claude-operation', enrichedEvent);
      console.log('[ClaudeEvents] Forwarded:', enrichedEvent.operation, enrichedEvent.nodeId || event.file_path);
    }

    // Cleanup event file
    try {
      fs.unlinkSync(eventFilePath);
    } catch (err) {
      console.error('[ClaudeEvents] Cleanup failed:', eventFilePath);
    }
  }

  isProcessingQueue = false;
}

function enrichEventWithNodeId(event) {
  // Determine sourceType from file path
  let sourceType = 'unknown';
  let relativePath = event.file_path;

  // Check if path contains .planning/ or src/
  if (event.file_path.includes('/.planning/') || event.file_path.includes('\\.planning\\')) {
    sourceType = 'planning';
    // Extract relative path from .planning/
    const match = event.file_path.match(/\.planning[\/\\](.+)$/);
    if (match) relativePath = match[1];
  } else if (event.file_path.includes('/src/') || event.file_path.includes('\\src\\')) {
    sourceType = 'src';
    // Extract relative path from src/
    const match = event.file_path.match(/src[\/\\](.+)$/);
    if (match) relativePath = match[1];
  }

  // Build node ID matching graph-builder.js pattern
  // Format: sourceType:/relative/path
  const nodeId = sourceType !== 'unknown'
    ? `${sourceType}:/${relativePath.replace(/\\/g, '/')}`
    : null;

  return {
    ...event,
    nodeId,
    sourceType
  };
}

app.whenReady().then(() => {
  // Register ALL IPC handlers BEFORE creating window to avoid race conditions

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

      // Build directory configs for multi-directory parsing
      const directoryConfigs = [
        {
          path: path.join(projectPath, '.planning'),
          sourceType: 'planning',
          ignorePatterns: []
        },
        {
          path: path.join(projectPath, 'src'),
          sourceType: 'src',
          ignorePatterns: DEFAULT_SRC_IGNORE_PATTERNS
        }
      ];

      // Use parseDirectories for unified multi-directory tree
      const directory = parseDirectories(directoryConfigs, projectPath);
      const state = parseState(planningPath);

      return {
        roadmap,
        requirements,
        directory,
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
      // Try VS Code first (most likely editor for developers)
      try {
        execSync(`code "${filePath}"`, { stdio: 'ignore' });
        return { success: true, editor: 'vscode' };
      } catch (codeErr) {
        // VS Code not available, try other common editors
        const editors = ['subl', 'atom', 'gedit', 'kate', 'xed'];
        for (const editor of editors) {
          try {
            execSync(`which ${editor}`, { stdio: 'ignore' });
            execSync(`${editor} "${filePath}"`, { stdio: 'ignore' });
            return { success: true, editor };
          } catch (e) {
            // Editor not found, try next
          }
        }
      }

      // Fall back to shell.openPath (system default)
      const result = await shell.openPath(filePath);
      if (result) {
        // shell.openPath returns empty string on success, error message on failure
        return { error: result };
      }
      return { success: true, editor: 'system' };
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

  // IPC handler for reading file content
  ipcMain.handle('read-file-content', async (event, filePath) => {
    try {
      const stats = fs.statSync(filePath);
      if (stats.isDirectory()) {
        return { error: 'Cannot read directory content', isDirectory: true };
      }

      // Limit file size to 100KB for preview
      if (stats.size > 100 * 1024) {
        const content = fs.readFileSync(filePath, 'utf-8').substring(0, 100 * 1024);
        return {
          content: content + '\n\n... (truncated, file too large)',
          size: stats.size,
          truncated: true,
          modified: stats.mtime
        };
      }

      const content = fs.readFileSync(filePath, 'utf-8');
      return {
        content,
        size: stats.size,
        truncated: false,
        modified: stats.mtime
      };
    } catch (error) {
      console.error('Error reading file:', error);
      return { error: error.message };
    }
  });

  // IPC handler for getting file stats
  ipcMain.handle('get-file-stats', async (event, filePath) => {
    try {
      const stats = fs.statSync(filePath);
      return {
        size: stats.size,
        modified: stats.mtime,
        created: stats.birthtime,
        isDirectory: stats.isDirectory(),
        isFile: stats.isFile()
      };
    } catch (error) {
      console.error('Error getting file stats:', error);
      return { error: error.message };
    }
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

  // IPC handler for getting git status
  ipcMain.handle('get-git-status', async (event, projectPath) => {
    try {
      const output = runGitCommand('git status --porcelain', projectPath);

      // If null, not a git repo or git not available
      if (output === null) {
        return { modified: [], staged: [], untracked: [] };
      }

      const modified = [];
      const staged = [];
      const untracked = [];

      const lines = output.split('\n').filter(line => line.length > 0);

      for (const line of lines) {
        // Format: XY filename
        // X = index status, Y = worktree status
        const indexStatus = line.charAt(0);
        const worktreeStatus = line.charAt(1);
        const filename = line.substring(3);

        // Staged changes (first column has non-space, non-?)
        if (indexStatus !== ' ' && indexStatus !== '?') {
          staged.push(filename);
        }

        // Unstaged modifications (second column is M)
        if (worktreeStatus === 'M') {
          modified.push(filename);
        }

        // Untracked files
        if (indexStatus === '?' && worktreeStatus === '?') {
          untracked.push(filename);
        }
      }

      return { modified, staged, untracked };
    } catch (error) {
      console.error('Error getting git status:', error);
      return { modified: [], staged: [], untracked: [], error: error.message };
    }
  });

  // IPC handler for getting current git branch
  ipcMain.handle('get-git-branch', async (event, projectPath) => {
    try {
      // Try to get current branch name
      let branch = runGitCommand('git branch --show-current', projectPath);

      // If empty (detached HEAD), get short commit hash
      if (branch === null || branch === '') {
        branch = runGitCommand('git rev-parse --short HEAD', projectPath);
        if (branch) {
          branch = `(${branch})`; // Indicate detached HEAD
        }
      }

      // If still null, not a git repo
      if (branch === null) {
        return { branch: null };
      }

      return { branch };
    } catch (error) {
      console.error('Error getting git branch:', error);
      return { branch: null, error: error.message };
    }
  });

  // IPC handler for getting recent git commits
  ipcMain.handle('get-git-commits', async (event, projectPath, limit = 10) => {
    try {
      const output = runGitCommand(`git log --oneline -n ${limit}`, projectPath);

      // If null, not a git repo or no commits
      if (output === null || output === '') {
        return { commits: [] };
      }

      const commits = output.split('\n')
        .filter(line => line.length > 0)
        .map(line => {
          const spaceIndex = line.indexOf(' ');
          if (spaceIndex === -1) {
            return { hash: line, message: '' };
          }
          return {
            hash: line.substring(0, spaceIndex),
            message: line.substring(spaceIndex + 1)
          };
        });

      return { commits };
    } catch (error) {
      console.error('Error getting git commits:', error);
      return { commits: [], error: error.message };
    }
  });

  // IPC handler for getting file diff against HEAD
  ipcMain.handle('get-git-diff', async (event, projectPath, filePath) => {
    try {
      // Get diff for specific file against HEAD (last commit)
      // filePath is relative to project root (e.g., 'src/main.js' or '.planning/STATE.md')
      const output = runGitCommand(`git diff HEAD -- "${filePath}"`, projectPath);

      // If null or empty, check if file is untracked
      if (output === null || output === '') {
        // Check if file is untracked (new file not yet committed)
        const status = runGitCommand(`git status --porcelain -- "${filePath}"`, projectPath);
        if (status && status.startsWith('??')) {
          return { diff: null, status: 'untracked', message: 'New file (not yet committed)' };
        }
        return { diff: null, status: 'unchanged', message: 'No changes since last commit' };
      }

      return { diff: output, status: 'changed' };
    } catch (error) {
      console.error('Error getting git diff:', error);
      return { diff: null, error: error.message };
    }
  });

  // IPC handler for opening external URLs
  ipcMain.handle('open-external', async (event, url) => {
    console.log('[Main] Opening external URL:', url);
    try {
      await shell.openExternal(url);
      console.log('[Main] External URL opened successfully');
    } catch (err) {
      console.error('[Main] Failed to open external URL:', err);
      throw err;
    }
  });

  // Create window AFTER all IPC handlers are registered
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  app.quit();
});
