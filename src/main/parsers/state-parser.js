const fs = require('fs');
const path = require('path');

/**
 * Parse STATE.md to extract current project position and blockers
 * @param {string} planningPath - Path to .planning/ directory
 * @returns {Object} Parsed state data
 */
function parseState(planningPath) {
  const statePath = path.join(planningPath, 'STATE.md');

  if (!fs.existsSync(statePath)) {
    return {
      currentPhase: null,
      currentPlan: null,
      status: 'unknown',
      blockers: [],
      error: 'STATE.md not found'
    };
  }

  const content = fs.readFileSync(statePath, 'utf-8');

  // Extract current phase
  // Format: Phase: 1 of 6 (Foundation)
  // Or: **Current focus:** Phase 1 - Foundation
  let currentPhase = null;
  const phaseMatch = content.match(/Phase:\s*(\d+)\s*of\s*\d+/i) ||
                     content.match(/Current focus:\s*Phase\s*(\d+)/i);
  if (phaseMatch) {
    currentPhase = parseInt(phaseMatch[1], 10);
  }

  // Extract current plan
  // Format: Plan: 2 of 4 in current phase
  let currentPlan = null;
  const planMatch = content.match(/Plan:\s*(\d+)\s*of\s*\d+/i);
  if (planMatch) {
    currentPlan = parseInt(planMatch[1], 10);
  }

  // Extract status
  // Format: Status: Ready to plan | In progress | Blocked
  let status = 'pending';
  const statusMatch = content.match(/Status:\s*([^\n]+)/i);
  if (statusMatch) {
    const statusText = statusMatch[1].toLowerCase().trim();
    if (statusText.includes('complete')) {
      status = 'complete';
    } else if (statusText.includes('progress') || statusText.includes('executing')) {
      status = 'in-progress';
    } else if (statusText.includes('blocked')) {
      status = 'blocked';
    } else if (statusText.includes('ready')) {
      status = 'pending';
    }
  }

  // Extract blockers from Blockers/Concerns section
  const blockers = [];
  const blockersMatch = content.match(/### Blockers\/Concerns\s*\n([\s\S]*?)(?=\n##|\n---|\n\*|$)/i);
  if (blockersMatch) {
    const blockersContent = blockersMatch[1];
    // Parse bullet points as blockers
    const blockerLines = blockersContent.match(/[-*]\s+([^\n]+)/g);
    if (blockerLines) {
      for (const line of blockerLines) {
        const blockerText = line.replace(/^[-*]\s+/, '').trim();
        if (blockerText && !blockerText.toLowerCase().includes('none')) {
          blockers.push({
            id: `blocker-${blockers.length + 1}`,
            description: blockerText
          });
        }
      }
    }
  }

  // Extract pending todos that might be blockers
  const todosMatch = content.match(/### Pending Todos\s*\n([\s\S]*?)(?=\n##|\n---|\n\*|$)/i);
  if (todosMatch) {
    const todosContent = todosMatch[1];
    const todoLines = todosContent.match(/[-*]\s+([^\n]+)/g);
    if (todoLines) {
      for (const line of todoLines) {
        const todoText = line.replace(/^[-*]\s+/, '').trim();
        if (todoText && !todoText.toLowerCase().includes('none')) {
          // Mark as blocking if it contains blocking keywords
          if (todoText.toLowerCase().includes('block') ||
              todoText.toLowerCase().includes('wait') ||
              todoText.toLowerCase().includes('depend')) {
            blockers.push({
              id: `todo-blocker-${blockers.length + 1}`,
              description: todoText,
              type: 'todo'
            });
          }
        }
      }
    }
  }

  return {
    currentPhase,
    currentPlan,
    status,
    blockers
  };
}

module.exports = { parseState };
