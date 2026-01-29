/**
 * Activity Dispatcher
 *
 * Centralized routing of file operations to all renderer views.
 * Receives operations from Claude Code hooks and file watchers,
 * then dispatches to dashboard, heatmap, timeline, and diagram renderers.
 */

import { onClaudeOperation as dashboardOnOperation, onFileChanged as dashboardOnFileChanged } from './dashboard-renderer.js';
import { onFileOperation as heatmapOnOperation } from './heatmap-renderer.js';
import { recordOperation as timelineRecordOperation } from './timeline-renderer.js';
import { onFileOperation as notificationOnOperation, init as initNotifications } from './notification-renderer.js';

// Initialize notification system
initNotifications();

/**
 * Dispatch a Claude Code operation to all interested renderers
 * @param {Object} event - Operation event from Claude hooks
 * @param {string} event.operation - Operation type (read, write, edit, create, delete)
 * @param {string} event.file_path - Path to the file
 * @param {string} event.nodeId - Node ID for graph
 */
export function dispatchClaudeOperation(event) {
  const { operation, file_path, nodeId } = event;

  console.log('[ActivityDispatcher] Claude operation:', operation, file_path);

  // Normalize operation type
  const normalizedOp = normalizeOperation(operation);

  // Dispatch to dashboard renderer
  try {
    dashboardOnOperation({
      operation: normalizedOp,
      file_path: file_path
    });
  } catch (e) {
    console.error('[ActivityDispatcher] Dashboard error:', e);
  }

  // Dispatch to heatmap renderer
  try {
    heatmapOnOperation({
      operation: normalizedOp,
      file_path: file_path
    });
  } catch (e) {
    console.error('[ActivityDispatcher] Heatmap error:', e);
  }

  // Dispatch to timeline renderer
  try {
    timelineRecordOperation({
      operation: normalizedOp,
      file_path: file_path
    });
  } catch (e) {
    console.error('[ActivityDispatcher] Timeline error:', e);
  }

  // Dispatch to notification renderer
  try {
    notificationOnOperation({
      operation: normalizedOp,
      file_path: file_path
    });
  } catch (e) {
    console.error('[ActivityDispatcher] Notification error:', e);
  }
}

/**
 * Dispatch a file watcher event to all interested renderers
 * @param {Object} event - File change event from chokidar
 * @param {string} event.event - Event type (add, change, unlink)
 * @param {string} event.path - Path to the file
 * @param {string} event.sourceType - Source type (planning, src)
 */
export function dispatchFileChange(event) {
  const { event: eventType, path } = event;

  console.log('[ActivityDispatcher] File change:', eventType, path);

  // Map chokidar event to operation type
  const operation = eventType === 'add' ? 'create' :
                    eventType === 'unlink' ? 'delete' : 'write';

  // Dispatch to dashboard renderer
  try {
    dashboardOnFileChanged({
      event: eventType,
      path: path
    });
  } catch (e) {
    console.error('[ActivityDispatcher] Dashboard error:', e);
  }

  // Dispatch to heatmap renderer
  try {
    heatmapOnOperation({
      operation: operation,
      file_path: path
    });
  } catch (e) {
    console.error('[ActivityDispatcher] Heatmap error:', e);
  }

  // Dispatch to timeline renderer
  try {
    timelineRecordOperation({
      operation: operation,
      file_path: path
    });
  } catch (e) {
    console.error('[ActivityDispatcher] Timeline error:', e);
  }

  // Dispatch to notification renderer
  try {
    notificationOnOperation({
      operation: operation,
      file_path: path
    });
  } catch (e) {
    console.error('[ActivityDispatcher] Notification error:', e);
  }
}

/**
 * Normalize operation type to standard set
 */
function normalizeOperation(op) {
  const opLower = (op || '').toLowerCase();
  if (opLower.includes('read')) return 'read';
  if (opLower.includes('write') || opLower.includes('edit')) return 'write';
  if (opLower.includes('create') || opLower.includes('add')) return 'create';
  if (opLower.includes('delete') || opLower.includes('unlink')) return 'delete';
  return 'write';
}
