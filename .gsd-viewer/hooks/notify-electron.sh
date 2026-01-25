#!/usr/bin/env bash
#
# Claude Code PostToolUse hook observer script
# Purpose: Capture file operations (Read/Write/Edit) and write event files for GSD Viewer
#
# Input: JSON from stdin with structure:
#   {
#     "tool": "Read|Write|Edit",
#     "parameters": {
#       "file_path": "/absolute/path/to/file.txt",
#       ...other params...
#     },
#     "timestamp": 1234567890123
#   }
#
# Output: Event file in .gsd-viewer/events/ directory with schema:
#   {
#     "schema_version": "1.0",
#     "timestamp": 1234567890123,
#     "operation": "read|write|edit",
#     "file_path": "/absolute/path/to/file.txt",
#     "tool": "Read|Write|Edit",
#     "source": "claude-code"
#   }
#
# Critical design constraints:
# - ALWAYS exit 0 (never block Claude operations)
# - Log errors to file, NEVER to stderr (stderr blocks hooks)
# - Use atomic writes (temp file + mv) to prevent partial reads
# - Complete in <50ms (non-blocking performance requirement)

set -euo pipefail

# --- Configuration ---
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
ERROR_LOG="$SCRIPT_DIR/errors.log"
EVENT_DIR="$PROJECT_ROOT/.gsd-viewer/events"
SCHEMA_VERSION="1.0"

# --- Error Logging ---
# All errors go to file, never stderr (blocks Claude)
log_error() {
  echo "[$(date -Iseconds)] ERROR: $1" >> "$ERROR_LOG" 2>/dev/null || true
}

# --- Setup ---
# Ensure event directory exists
mkdir -p "$EVENT_DIR" 2>/dev/null || {
  log_error "Failed to create event directory: $EVENT_DIR"
  exit 0
}

# --- Read Hook Input ---
# Claude provides JSON on stdin
HOOK_INPUT=$(cat 2>/dev/null) || {
  log_error "Failed to read stdin"
  exit 0
}

# Validate input is not empty
if [[ -z "$HOOK_INPUT" ]]; then
  log_error "Empty stdin input"
  exit 0
fi

# --- Parse JSON ---
# Try jq if available, fallback to grep/sed patterns
if command -v jq &> /dev/null; then
  # Use jq for robust parsing
  TOOL=$(echo "$HOOK_INPUT" | jq -r '.tool // empty' 2>/dev/null) || {
    log_error "jq failed to parse tool field"
    exit 0
  }

  # Try multiple possible parameter field names (file_path, path)
  FILE_PATH=$(echo "$HOOK_INPUT" | jq -r '.parameters.file_path // .parameters.path // empty' 2>/dev/null) || {
    log_error "jq failed to parse file_path field"
    exit 0
  }

  # Timestamp from hook or current time
  TIMESTAMP=$(echo "$HOOK_INPUT" | jq -r '.timestamp // empty' 2>/dev/null)
  if [[ -z "$TIMESTAMP" ]]; then
    TIMESTAMP=$(date +%s%3N)  # Unix milliseconds
  fi
else
  # Fallback: grep/sed parsing (less reliable but functional)
  TOOL=$(echo "$HOOK_INPUT" | grep -oP '"tool"\s*:\s*"\K[^"]+' 2>/dev/null) || {
    log_error "grep failed to parse tool field (jq not available)"
    exit 0
  }

  FILE_PATH=$(echo "$HOOK_INPUT" | grep -oP '"file_path"\s*:\s*"\K[^"]+' 2>/dev/null)
  if [[ -z "$FILE_PATH" ]]; then
    FILE_PATH=$(echo "$HOOK_INPUT" | grep -oP '"path"\s*:\s*"\K[^"]+' 2>/dev/null) || {
      log_error "grep failed to parse file_path field"
      exit 0
    }
  fi

  TIMESTAMP=$(echo "$HOOK_INPUT" | grep -oP '"timestamp"\s*:\s*\K[0-9]+' 2>/dev/null)
  if [[ -z "$TIMESTAMP" ]]; then
    TIMESTAMP=$(date +%s%3N)
  fi
fi

# Validate required fields
if [[ -z "$TOOL" ]]; then
  log_error "Missing tool field in hook input"
  exit 0
fi

if [[ -z "$FILE_PATH" ]]; then
  log_error "Missing file_path field in hook input"
  exit 0
fi

# --- Map Tool to Operation ---
case "$TOOL" in
  Read)
    OPERATION="read"
    ;;
  Write)
    OPERATION="write"
    ;;
  Edit)
    OPERATION="edit"
    ;;
  *)
    log_error "Unknown tool: $TOOL"
    exit 0
    ;;
esac

# --- Generate Event File ---
# Filename: {timestamp}-{operation}-{random}.json
# Random suffix for uniqueness in case of same-millisecond operations
RANDOM_SUFFIX=$(head -c 8 /dev/urandom | od -An -tx1 | tr -d ' \n')
EVENT_FILENAME="${TIMESTAMP}-${OPERATION}-${RANDOM_SUFFIX}.json"
EVENT_PATH="$EVENT_DIR/$EVENT_FILENAME"

# Create event JSON
EVENT_JSON=$(cat <<EOF
{
  "schema_version": "$SCHEMA_VERSION",
  "timestamp": $TIMESTAMP,
  "operation": "$OPERATION",
  "file_path": "$FILE_PATH",
  "tool": "$TOOL",
  "source": "claude-code"
}
EOF
)

# --- Atomic Write ---
# Write to temp file, then mv for atomicity (prevents partial reads by chokidar)
TEMP_FILE="${EVENT_PATH}.tmp"

echo "$EVENT_JSON" > "$TEMP_FILE" 2>/dev/null || {
  log_error "Failed to write temp event file: $TEMP_FILE"
  exit 0
}

mv "$TEMP_FILE" "$EVENT_PATH" 2>/dev/null || {
  log_error "Failed to move temp file to event path: $EVENT_PATH"
  rm -f "$TEMP_FILE" 2>/dev/null || true
  exit 0
}

# --- Success ---
# Exit 0 to never block Claude operations
exit 0
