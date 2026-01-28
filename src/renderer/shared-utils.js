/**
 * Shared Utility Functions
 *
 * Pure utility functions used by both graph-renderer and diagram-renderer.
 * Extracted to break circular dependencies between renderers.
 */

/**
 * Format file size in human readable format
 * @param {number} bytes - File size in bytes
 * @returns {string} Formatted size string
 */
export function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

/**
 * Format timestamp as relative time
 * @param {number} timestamp - Unix timestamp in milliseconds
 * @returns {string} Relative time string
 */
export function formatRelativeTime(timestamp) {
  const diff = Date.now() - timestamp;
  const seconds = Math.floor(diff / 1000);

  if (seconds < 60) {
    return 'Just now';
  }

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes} min ago`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  }

  // For older times, show the date
  const date = new Date(timestamp);
  return date.toLocaleDateString();
}
