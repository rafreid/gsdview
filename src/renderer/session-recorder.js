/**
 * Session Recorder
 *
 * Records, replays, and exports GSD sessions.
 * Captures all file operations with timestamps for later review.
 */

// Recording state
let isRecording = false;
let currentSession = null;
let recordings = []; // Saved recordings in localStorage

// Playback state
let isPlaying = false;
let playbackSession = null;
let playbackIndex = 0;
let playbackSpeed = 1;
let playbackTimeoutId = null;

// Callbacks for playback events
let onPlaybackOperation = null;

/**
 * Initialize session recorder
 */
export function init() {
  loadRecordings();
  updateRecordButton();
  console.log('[SessionRecorder] Initialized with', recordings.length, 'saved recordings');
}

/**
 * Start recording a new session
 */
export function startRecording() {
  if (isRecording) return;

  isRecording = true;
  currentSession = {
    id: Date.now().toString(),
    name: `Session ${new Date().toLocaleString()}`,
    startTime: Date.now(),
    endTime: null,
    operations: []
  };

  updateRecordButton();
  console.log('[SessionRecorder] Recording started:', currentSession.id);
}

/**
 * Stop recording and save the session
 */
export function stopRecording() {
  if (!isRecording || !currentSession) return;

  isRecording = false;
  currentSession.endTime = Date.now();

  // Save to recordings list
  recordings.unshift(currentSession);

  // Keep only last 10 recordings
  if (recordings.length > 10) {
    recordings = recordings.slice(0, 10);
  }

  saveRecordings();

  console.log('[SessionRecorder] Recording stopped:', currentSession.operations.length, 'operations');

  currentSession = null;
  updateRecordButton();
}

/**
 * Toggle recording state
 */
export function toggleRecording() {
  if (isRecording) {
    stopRecording();
  } else {
    startRecording();
  }
}

/**
 * Record a file operation
 */
export function recordOperation(data) {
  if (!isRecording || !currentSession) return;

  const { operation, file_path } = data;

  currentSession.operations.push({
    timestamp: Date.now(),
    relativeTime: Date.now() - currentSession.startTime,
    operation,
    file_path
  });
}

/**
 * Start playback of a recorded session
 */
export function startPlayback(sessionId, callback) {
  const session = recordings.find(r => r.id === sessionId);
  if (!session || session.operations.length === 0) {
    console.error('[SessionRecorder] Session not found or empty:', sessionId);
    return;
  }

  stopPlayback();

  isPlaying = true;
  playbackSession = session;
  playbackIndex = 0;
  onPlaybackOperation = callback;

  playNextOperation();
  updatePlaybackUI();

  console.log('[SessionRecorder] Playback started:', session.name);
}

/**
 * Play the next operation in sequence
 */
function playNextOperation() {
  if (!isPlaying || !playbackSession || playbackIndex >= playbackSession.operations.length) {
    stopPlayback();
    return;
  }

  const op = playbackSession.operations[playbackIndex];

  // Fire callback with operation
  if (onPlaybackOperation) {
    onPlaybackOperation(op);
  }

  playbackIndex++;
  updatePlaybackUI();

  // Calculate delay to next operation
  if (playbackIndex < playbackSession.operations.length) {
    const nextOp = playbackSession.operations[playbackIndex];
    const delay = (nextOp.relativeTime - op.relativeTime) / playbackSpeed;

    playbackTimeoutId = setTimeout(playNextOperation, Math.max(delay, 50));
  } else {
    stopPlayback();
  }
}

/**
 * Stop playback
 */
export function stopPlayback() {
  if (playbackTimeoutId) {
    clearTimeout(playbackTimeoutId);
    playbackTimeoutId = null;
  }

  isPlaying = false;
  playbackSession = null;
  playbackIndex = 0;
  onPlaybackOperation = null;

  updatePlaybackUI();
}

/**
 * Set playback speed
 */
export function setPlaybackSpeed(speed) {
  playbackSpeed = speed;
}

/**
 * Get playback progress (0-1)
 */
export function getPlaybackProgress() {
  if (!playbackSession || playbackSession.operations.length === 0) return 0;
  return playbackIndex / playbackSession.operations.length;
}

/**
 * Export session as markdown report
 */
export function exportSession(sessionId) {
  const session = recordings.find(r => r.id === sessionId);
  if (!session) {
    console.error('[SessionRecorder] Session not found:', sessionId);
    return null;
  }

  const duration = session.endTime - session.startTime;
  const durationMin = Math.round(duration / 60000);

  // Count operations by type
  const counts = { read: 0, write: 0, create: 0, delete: 0 };
  session.operations.forEach(op => {
    counts[op.operation] = (counts[op.operation] || 0) + 1;
  });

  // Group operations by file
  const fileOps = new Map();
  session.operations.forEach(op => {
    if (!fileOps.has(op.file_path)) {
      fileOps.set(op.file_path, []);
    }
    fileOps.get(op.file_path).push(op);
  });

  // Generate markdown
  let md = `# GSD Session Report\n\n`;
  md += `**Session:** ${session.name}\n\n`;
  md += `**Date:** ${new Date(session.startTime).toLocaleString()}\n\n`;
  md += `**Duration:** ${durationMin} minutes\n\n`;
  md += `**Total Operations:** ${session.operations.length}\n\n`;

  md += `## Operation Summary\n\n`;
  md += `| Type | Count |\n`;
  md += `|------|-------|\n`;
  if (counts.read) md += `| Read | ${counts.read} |\n`;
  if (counts.write) md += `| Write | ${counts.write} |\n`;
  if (counts.create) md += `| Create | ${counts.create} |\n`;
  if (counts.delete) md += `| Delete | ${counts.delete} |\n`;
  md += `\n`;

  md += `## Files Touched\n\n`;
  md += `| File | Operations |\n`;
  md += `|------|------------|\n`;
  fileOps.forEach((ops, file) => {
    const opTypes = [...new Set(ops.map(o => o.operation))].join(', ');
    const shortPath = file.split('/').slice(-2).join('/');
    md += `| ${shortPath} | ${opTypes} (${ops.length}x) |\n`;
  });
  md += `\n`;

  md += `## Timeline\n\n`;
  md += `\`\`\`\n`;
  session.operations.forEach(op => {
    const relMin = Math.floor(op.relativeTime / 60000);
    const relSec = Math.floor((op.relativeTime % 60000) / 1000);
    const shortPath = op.file_path.split('/').slice(-2).join('/');
    md += `[${relMin}:${relSec.toString().padStart(2, '0')}] ${op.operation.toUpperCase().padEnd(6)} ${shortPath}\n`;
  });
  md += `\`\`\`\n`;

  md += `\n---\n*Generated by GSD Viewer*\n`;

  return md;
}

/**
 * Download session as markdown file
 */
export function downloadSession(sessionId) {
  const md = exportSession(sessionId);
  if (!md) return;

  const session = recordings.find(r => r.id === sessionId);
  const filename = `gsd-session-${session.id}.md`;

  const blob = new Blob([md], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();

  URL.revokeObjectURL(url);

  console.log('[SessionRecorder] Downloaded:', filename);
}

/**
 * Get all saved recordings
 */
export function getRecordings() {
  return [...recordings];
}

/**
 * Delete a recording
 */
export function deleteRecording(sessionId) {
  recordings = recordings.filter(r => r.id !== sessionId);
  saveRecordings();
}

/**
 * Load recordings from localStorage
 */
function loadRecordings() {
  try {
    const saved = localStorage.getItem('gsdv-recordings');
    if (saved) {
      recordings = JSON.parse(saved);
    }
  } catch (e) {
    console.error('[SessionRecorder] Failed to load recordings:', e);
    recordings = [];
  }
}

/**
 * Save recordings to localStorage
 */
function saveRecordings() {
  try {
    localStorage.setItem('gsdv-recordings', JSON.stringify(recordings));
  } catch (e) {
    console.error('[SessionRecorder] Failed to save recordings:', e);
  }
}

/**
 * Check if currently recording
 */
export function getIsRecording() {
  return isRecording;
}

/**
 * Check if currently playing back
 */
export function getIsPlaying() {
  return isPlaying;
}

/**
 * Update the record button UI
 */
function updateRecordButton() {
  const btn = document.getElementById('record-session-btn');
  if (!btn) return;

  if (isRecording) {
    btn.classList.add('recording');
    btn.innerHTML = '<span class="record-dot"></span> Stop';
    btn.title = 'Stop recording session';
  } else {
    btn.classList.remove('recording');
    btn.innerHTML = '<span class="record-dot"></span> Record';
    btn.title = 'Start recording session';
  }
}

/**
 * Update playback UI
 */
function updatePlaybackUI() {
  // This would update any playback UI elements
  // Currently handled by the session panel
}

/**
 * Show session manager panel
 */
export function showSessionManager() {
  // Remove existing if present
  const existing = document.getElementById('session-manager-panel');
  if (existing) {
    existing.remove();
    document.getElementById('session-manager-overlay')?.remove();
    return;
  }

  const panel = document.createElement('div');
  panel.id = 'session-manager-panel';
  panel.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: #1a1a2e;
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 8px;
    padding: 20px;
    z-index: 10001;
    min-width: 400px;
    max-height: 500px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
  `;

  let recordingsHtml = '';
  if (recordings.length === 0) {
    recordingsHtml = '<div style="color: #666; text-align: center; padding: 20px;">No recordings yet</div>';
  } else {
    recordingsHtml = recordings.map(r => {
      const duration = Math.round((r.endTime - r.startTime) / 60000);
      const date = new Date(r.startTime).toLocaleDateString();
      return `
        <div class="recording-item" style="
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px;
          background: rgba(255, 255, 255, 0.05);
          border-radius: 4px;
          margin-bottom: 8px;
        ">
          <div style="flex: 1;">
            <div style="color: white; font-size: 13px;">${r.name}</div>
            <div style="color: #666; font-size: 11px;">${date} • ${duration}min • ${r.operations.length} ops</div>
          </div>
          <button onclick="window.playRecording('${r.id}')" style="
            padding: 6px 12px;
            background: rgba(78, 205, 196, 0.2);
            border: 1px solid #4ECDC4;
            border-radius: 4px;
            color: #4ECDC4;
            cursor: pointer;
          ">▶ Play</button>
          <button onclick="window.downloadRecording('${r.id}')" style="
            padding: 6px 12px;
            background: rgba(255, 255, 255, 0.1);
            border: 1px solid rgba(255, 255, 255, 0.3);
            border-radius: 4px;
            color: white;
            cursor: pointer;
          ">📄 Export</button>
          <button onclick="window.deleteRecordingItem('${r.id}')" style="
            padding: 6px 12px;
            background: rgba(231, 76, 60, 0.2);
            border: 1px solid rgba(231, 76, 60, 0.5);
            border-radius: 4px;
            color: #E74C3C;
            cursor: pointer;
          ">🗑</button>
        </div>
      `;
    }).join('');
  }

  panel.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
      <h3 style="margin: 0; color: #4ECDC4;">Session Recordings</h3>
      <button id="close-session-manager" style="background: none; border: none; color: #888; cursor: pointer; font-size: 20px;">×</button>
    </div>
    <div id="recording-status" style="
      padding: 10px;
      background: ${isRecording ? 'rgba(231, 76, 60, 0.2)' : 'rgba(78, 205, 196, 0.1)'};
      border-radius: 4px;
      margin-bottom: 15px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    ">
      <span style="color: ${isRecording ? '#E74C3C' : '#4ECDC4'};">
        ${isRecording ? '⏺ Recording in progress...' : '⏹ Not recording'}
      </span>
      <button id="toggle-recording-btn" style="
        padding: 6px 16px;
        background: ${isRecording ? 'rgba(231, 76, 60, 0.3)' : 'rgba(46, 204, 113, 0.3)'};
        border: 1px solid ${isRecording ? '#E74C3C' : '#2ECC71'};
        border-radius: 4px;
        color: ${isRecording ? '#E74C3C' : '#2ECC71'};
        cursor: pointer;
      ">${isRecording ? '⏹ Stop' : '⏺ Start'}</button>
    </div>
    <div style="flex: 1; overflow-y: auto;">
      ${recordingsHtml}
    </div>
    <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid rgba(255,255,255,0.1); display: flex; gap: 10px;">
      <select id="playback-speed" style="
        padding: 6px 10px;
        background: rgba(255, 255, 255, 0.1);
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 4px;
        color: white;
      ">
        <option value="1">1x Speed</option>
        <option value="2">2x Speed</option>
        <option value="4">4x Speed</option>
        <option value="8">8x Speed</option>
      </select>
    </div>
  `;

  document.body.appendChild(panel);

  // Add overlay
  const overlay = document.createElement('div');
  overlay.id = 'session-manager-overlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: 10000;
  `;
  overlay.addEventListener('click', () => {
    panel.remove();
    overlay.remove();
  });
  document.body.insertBefore(overlay, panel);

  // Event handlers
  document.getElementById('close-session-manager').addEventListener('click', () => {
    panel.remove();
    overlay.remove();
  });

  document.getElementById('toggle-recording-btn').addEventListener('click', () => {
    toggleRecording();
    panel.remove();
    overlay.remove();
    showSessionManager(); // Refresh panel
  });

  document.getElementById('playback-speed').addEventListener('change', (e) => {
    setPlaybackSpeed(parseInt(e.target.value));
  });

  // Global handlers for button clicks
  window.playRecording = (id) => {
    panel.remove();
    overlay.remove();
    startPlayback(id, (op) => {
      console.log('[Playback]', op.operation, op.file_path);
      // Could dispatch to renderers here
    });
  };

  window.downloadRecording = (id) => {
    downloadSession(id);
  };

  window.deleteRecordingItem = (id) => {
    if (confirm('Delete this recording?')) {
      deleteRecording(id);
      panel.remove();
      overlay.remove();
      showSessionManager(); // Refresh
    }
  };
}
