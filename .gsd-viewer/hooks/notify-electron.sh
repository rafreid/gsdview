#!/usr/bin/env bash
#
# Claude Code PostToolUse hook observer script
# Purpose: Capture file operations (Read/Write/Edit) and write event files for GSD Viewer
#
# Input: JSON from stdin with structure (Claude Code current schema):
#   {
#     "session_id": "...",
#     "hook_event_name": "PostToolUse",
#     "tool_name": "Read|Write|Edit",
#     "tool_input": {
#       "file_path": "/absolute/path/to/file.txt",
#       ...other params...
#     },
#     "tool_response": {...}
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

# Debug: Log the raw input to help diagnose parsing issues
echo "[$(date -Iseconds)] DEBUG INPUT: $HOOK_INPUT" >> "$ERROR_LOG" 2>/dev/null || true

# --- Parse JSON ---
# Try jq if available, fallback to grep/sed patterns
# Note: Claude Code schema uses tool_name and tool_input (not tool and parameters)
if command -v jq &> /dev/null; then
  # Use jq for robust parsing
  # Try new schema (tool_name) first, fallback to old schema (tool)
  TOOL=$(echo "$HOOK_INPUT" | jq -r '.tool_name // .tool // empty' 2>/dev/null) || {
    log_error "jq failed to parse tool field"
    exit 0
  }

  # Try new schema (tool_input.file_path) first, fallback to old schema (parameters.file_path)
  FILE_PATH=$(echo "$HOOK_INPUT" | jq -r '.tool_input.file_path // .tool_input.path // .parameters.file_path // .parameters.path // empty' 2>/dev/null) || {
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
  # Try new schema (tool_name) first, fallback to old schema (tool)
  TOOL=$(echo "$HOOK_INPUT" | grep -oP '"tool_name"\s*:\s*"\K[^"]+' 2>/dev/null)
  if [[ -z "$TOOL" ]]; then
    TOOL=$(echo "$HOOK_INPUT" | grep -oP '"tool"\s*:\s*"\K[^"]+' 2>/dev/null) || {
      log_error "grep failed to parse tool field (jq not available)"
      exit 0
    }
  fi

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
# Write to temp file OUTSIDE the events directory, then mv for atomicity
# (chokidar watches the events directory and can race with .tmp files inside it)
TEMP_FILE="/tmp/gsd-event-${RANDOM_SUFFIX}.json"

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
