/**
 * GSD Pipeline Parser
 *
 * Parses GSD project state and extracts structured pipeline data.
 * Determines which GSD stage each phase is in and collects artifact status.
 */

// Use window.require for Electron renderer with nodeIntegration
const fs = window.require('fs');
const path = window.require('path');

/**
 * The 6 stages of GSD workflow
 */
export const GSD_STAGES = [
  { id: 'initialize', name: 'Initialize', artifactPatterns: [] },
  { id: 'discuss', name: 'Discuss', artifactPatterns: ['CONTEXT.md', 'RESEARCH.md'] },
  { id: 'plan', name: 'Plan', artifactPatterns: ['*-PLAN.md'] },
  { id: 'execute', name: 'Execute', artifactPatterns: ['*-SUMMARY.md'] },
  { id: 'verify', name: 'Verify', artifactPatterns: ['*-VERIFICATION.md', '*-UAT.md'] },
  { id: 'complete', name: 'Complete', artifactPatterns: [] }
];

/**
 * Parse GSD project state and extract pipeline data
 *
 * @param {string} projectPath - Absolute path to project root
 * @returns {Object} Pipeline data with stages, currentPhase, and phases
 */
export function parsePipelineState(projectPath) {
  console.log('[GSD Parser] Parsing project:', projectPath);

  // Read STATE.md to get current phase
  const currentPhase = parseCurrentPhase(projectPath);

  // Scan phases directory
  const phasesDir = path.join(projectPath, '.planning', 'phases');
  const phases = parsePhases(phasesDir);

  // Build stage summary
  const stages = buildStagesSummary(phases, currentPhase);

  return {
    stages,
    currentPhase,
    phases
  };
}

/**
 * Parse STATE.md to extract current phase info
 *
 * @param {string} projectPath - Project root path
 * @returns {Object} Current phase info { number, name, stage }
 */
function parseCurrentPhase(projectPath) {
  const statePath = path.join(projectPath, '.planning', 'STATE.md');

  if (!fs.existsSync(statePath)) {
    return { number: null, name: 'Unknown', stage: 'initialize' };
  }

  const content = fs.readFileSync(statePath, 'utf8');

  // Extract phase number and name from "Phase: NN - Name" line
  const phaseMatch = content.match(/Phase:\s*(\d+)\s*-\s*([^\n]+)/);
  if (!phaseMatch) {
    return { number: null, name: 'Unknown', stage: 'initialize' };
  }

  const phaseNumber = parseInt(phaseMatch[1], 10);
  const phaseName = phaseMatch[2].trim();

  // Determine stage by checking phase directory
  const phasesDir = path.join(projectPath, '.planning', 'phases');
  const phaseDir = findPhaseDirectory(phasesDir, phaseNumber);

  const stage = phaseDir ? getPhaseStage(phaseDir) : 'plan';

  return {
    number: phaseNumber,
    name: phaseName,
    stage
  };
}

/**
 * Find phase directory by number
 *
 * @param {string} phasesDir - Phases directory path
 * @param {number} phaseNumber - Phase number to find
 * @returns {string|null} Full path to phase directory or null
 */
function findPhaseDirectory(phasesDir, phaseNumber) {
  if (!fs.existsSync(phasesDir)) return null;

  const entries = fs.readdirSync(phasesDir);
  const phasePrefix = String(phaseNumber).padStart(2, '0') + '-';

  for (const entry of entries) {
    if (entry.startsWith(phasePrefix)) {
      return path.join(phasesDir, entry);
    }
  }

  return null;
}

/**
 * Parse all phases from phases directory
 *
 * @param {string} phasesDir - Path to .planning/phases
 * @returns {Array} Array of phase objects
 */
function parsePhases(phasesDir) {
  if (!fs.existsSync(phasesDir)) {
    return [];
  }

  const entries = fs.readdirSync(phasesDir);
  const phases = [];

  for (const entry of entries) {
    const phaseDir = path.join(phasesDir, entry);
    const stats = fs.statSync(phaseDir);

    if (!stats.isDirectory()) continue;

    // Extract phase number from directory name (NN-name)
    const match = entry.match(/^(\d+)-(.+)$/);
    if (!match) continue;

    const phaseNumber = parseInt(match[1], 10);
    const phaseName = match[2];

    // Determine stage and collect artifacts
    const stage = getPhaseStage(phaseDir);
    const artifacts = collectArtifacts(phaseDir);
    const contextUsage = calculateContextUsage(phaseDir);

    phases.push({
      number: phaseNumber,
      name: phaseName,
      stage,
      artifacts,
      directory: phaseDir,
      contextUsage
    });
  }

  // Sort by phase number
  phases.sort((a, b) => a.number - b.number);

  return phases;
}

/**
 * Calculate context usage for a phase
 * Estimates Claude's context window utilization during phase execution
 *
 * @param {string} phaseDir - Path to phase directory
 * @returns {number} Context usage percentage (0-100)
 */
function calculateContextUsage(phaseDir) {
  const files = fs.readdirSync(phaseDir);

  // Find SUMMARY files for this phase
  const summaryFiles = files.filter(f => f.match(/^\d+-\d+-SUMMARY\.md$/));

  if (summaryFiles.length === 0) {
    // No SUMMARYs yet, phase not executed - default to 0
    return 0;
  }

  let totalContextUsage = 0;
  let summaryCount = 0;

  for (const summaryFile of summaryFiles) {
    const summaryPath = path.join(phaseDir, summaryFile);

    try {
      const content = fs.readFileSync(summaryPath, 'utf8');

      // Try to parse YAML frontmatter for explicit context_used metric
      const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
      if (frontmatterMatch) {
        const frontmatter = frontmatterMatch[1];

        // Look for context_used or similar metric
        const contextMatch = frontmatter.match(/context[_-]?used:\s*(\d+)/i);
        if (contextMatch) {
          totalContextUsage += parseInt(contextMatch[1], 10);
          summaryCount++;
          continue;
        }

        // No explicit metric - estimate based on files_modified count
        // Parse key-files section from frontmatter
        const modifiedMatch = frontmatter.match(/modified:\s*\n((?:\s*-\s*.+\n)*)/);
        if (modifiedMatch) {
          const modifiedLines = modifiedMatch[1].trim().split('\n');
          const fileCount = modifiedLines.filter(line => line.trim().startsWith('-')).length;

          // Estimate context usage based on file count
          let estimatedUsage;
          if (fileCount <= 2) {
            estimatedUsage = 15 + Math.random() * 10; // 15-25%
          } else if (fileCount <= 5) {
            estimatedUsage = 30 + Math.random() * 20; // 30-50%
          } else {
            estimatedUsage = 50 + Math.random() * 20; // 50-70%
          }

          totalContextUsage += estimatedUsage;
          summaryCount++;
        } else {
          // Fallback: assume moderate context usage
          totalContextUsage += 35;
          summaryCount++;
        }
      } else {
        // No frontmatter found - assume moderate context usage
        totalContextUsage += 35;
        summaryCount++;
      }

    } catch (err) {
      console.warn('[GSD Parser] Error reading SUMMARY file:', summaryPath, err);
      // Skip this summary
    }
  }

  // Return average context usage for the phase
  if (summaryCount === 0) {
    return 0;
  }

  return Math.round(totalContextUsage / summaryCount);
}

/**
 * Determine which GSD stage a phase is in
 *
 * @param {string} phaseDir - Path to phase directory
 * @returns {string} Stage ID
 */
export function getPhaseStage(phaseDir) {
  const files = fs.readdirSync(phaseDir);

  // Check for CONTEXT.md or RESEARCH.md → Discuss stage
  if (files.includes('CONTEXT.md') || files.includes('RESEARCH.md')) {
    return 'discuss';
  }

  // Check for PLAN files
  const hasPlanFiles = files.some(f => f.match(/^\d+-\d+-PLAN\.md$/));

  // Check for SUMMARY files
  const summaryFiles = files.filter(f => f.match(/^\d+-\d+-SUMMARY\.md$/));
  const hasSummaryFiles = summaryFiles.length > 0;

  // Check for VERIFICATION files
  const hasVerificationFiles = files.some(f =>
    f.match(/^\d+-\d+-(VERIFICATION|UAT)\.md$/)
  );

  if (hasVerificationFiles) {
    return 'verify';
  }

  if (hasSummaryFiles) {
    // If all plans have summaries, phase is complete
    if (hasPlanFiles) {
      const planFiles = files.filter(f => f.match(/^\d+-\d+-PLAN\.md$/));
      if (planFiles.length === summaryFiles.length) {
        return 'complete';
      }
    }
    return 'execute';
  }

  if (hasPlanFiles) {
    return 'plan';
  }

  // Default to initialize if nothing found
  return 'initialize';
}

/**
 * Collect artifacts from a phase directory
 *
 * @param {string} phaseDir - Path to phase directory
 * @returns {Array} Array of artifact objects
 */
function collectArtifacts(phaseDir) {
  const files = fs.readdirSync(phaseDir);
  const artifacts = [];

  for (const file of files) {
    // Skip non-markdown files
    if (!file.endsWith('.md')) continue;

    const artifactPath = path.join(phaseDir, file);
    const status = getArtifactStatus(artifactPath);

    artifacts.push({
      name: file,
      path: artifactPath,
      status
    });
  }

  // Sort artifacts: CONTEXT/RESEARCH first, then PLANs, then SUMMARYs
  artifacts.sort((a, b) => {
    const orderMap = {
      'CONTEXT.md': 0,
      'RESEARCH.md': 1
    };

    const orderA = orderMap[a.name] ?? (a.name.includes('PLAN') ? 2 : (a.name.includes('SUMMARY') ? 3 : 4));
    const orderB = orderMap[b.name] ?? (b.name.includes('PLAN') ? 2 : (b.name.includes('SUMMARY') ? 3 : 4));

    if (orderA !== orderB) return orderA - orderB;

    // Within same type, sort alphabetically
    return a.name.localeCompare(b.name);
  });

  return artifacts;
}

/**
 * Determine artifact completion status
 *
 * @param {string} artifactPath - Full path to artifact file
 * @returns {string} Status: 'done' | 'in-progress' | 'missing'
 */
export function getArtifactStatus(artifactPath) {
  if (!fs.existsSync(artifactPath)) {
    return 'missing';
  }

  const stats = fs.statSync(artifactPath);

  // Consider files > 50 bytes as done
  if (stats.size > 50) {
    return 'done';
  }

  // Small files are in-progress
  return 'in-progress';
}

/**
 * Build stage summary from phases
 *
 * @param {Array} phases - Array of phase objects
 * @param {Object} currentPhase - Current phase info
 * @returns {Array} Array of stage objects with status
 */
function buildStagesSummary(phases, currentPhase) {
  const stageSummary = GSD_STAGES.map(stage => ({
    id: stage.id,
    name: stage.name,
    status: 'pending',
    artifacts: [],
    contextUsage: 0
  }));

  // Aggregate artifacts and context usage by stage
  const stageContextUsages = {}; // Track context usage per stage for averaging

  for (const phase of phases) {
    const stageIndex = GSD_STAGES.findIndex(s => s.id === phase.stage);
    if (stageIndex === -1) continue;

    stageSummary[stageIndex].artifacts.push(...phase.artifacts);

    // Aggregate context usage (will average later)
    if (!stageContextUsages[phase.stage]) {
      stageContextUsages[phase.stage] = [];
    }
    if (phase.contextUsage > 0) {
      stageContextUsages[phase.stage].push(phase.contextUsage);
    }
  }

  // Calculate average context usage per stage
  for (const stageId in stageContextUsages) {
    const usages = stageContextUsages[stageId];
    if (usages.length > 0) {
      const avgUsage = usages.reduce((sum, val) => sum + val, 0) / usages.length;
      const stageIndex = GSD_STAGES.findIndex(s => s.id === stageId);
      if (stageIndex !== -1) {
        stageSummary[stageIndex].contextUsage = Math.round(avgUsage);
      }
    }
  }

  // Determine stage status based on current phase
  const currentStageIndex = GSD_STAGES.findIndex(s => s.id === currentPhase.stage);

  for (let i = 0; i < stageSummary.length; i++) {
    if (i < currentStageIndex) {
      stageSummary[i].status = 'complete';
    } else if (i === currentStageIndex) {
      stageSummary[i].status = 'in-progress';
    } else {
      stageSummary[i].status = 'pending';
    }
  }

  return stageSummary;
}
