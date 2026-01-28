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
 * @returns {Object} Pipeline data with stages, currentPhase, phases, and allFiles
 */
export function parsePipelineState(projectPath) {
  console.log('[GSD Parser] Parsing project:', projectPath);

  // Read STATE.md to get current phase
  const currentPhase = parseCurrentPhase(projectPath);

  // Scan phases directory
  const phasesDir = path.join(projectPath, '.planning', 'phases');
  const phases = parsePhases(phasesDir);

  // Collect ALL project files (not just phase artifacts)
  const allFiles = collectAllProjectFiles(projectPath);

  // Build stage summary
  const stages = buildStagesSummary(phases, currentPhase, allFiles);

  return {
    stages,
    currentPhase,
    phases,
    allFiles
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
 * Detect parallel agents working in a phase
 *
 * @param {string} phaseDir - Path to phase directory
 * @param {string} stageId - Stage ID (discuss, execute, etc.)
 * @returns {Array} Array of agent objects with type and label
 */
function detectParallelAgents(phaseDir, stageId) {
  const agents = [];

  if (stageId === 'discuss') {
    // Check for both CONTEXT.md and RESEARCH.md
    const hasContext = fs.existsSync(path.join(phaseDir, 'CONTEXT.md'));
    const hasResearch = fs.existsSync(path.join(phaseDir, 'RESEARCH.md'));

    if (hasContext && hasResearch) {
      agents.push(
        { type: 'discusser', label: 'Discusser', icon: '💬' },
        { type: 'researcher', label: 'Researcher', icon: '🔬' }
      );
    }
  } else if (stageId === 'execute') {
    // Check PLAN files for wave assignments
    const files = fs.readdirSync(phaseDir);
    const planFiles = files.filter(f => f.match(/^\d+-\d+-PLAN\.md$/));

    const waves = new Set();

    for (const planFile of planFiles) {
      const planPath = path.join(phaseDir, planFile);
      try {
        const content = fs.readFileSync(planPath, 'utf8');
        const frontmatter = content.match(/^---\n([\s\S]*?)\n---/);

        if (frontmatter) {
          const waveMatch = frontmatter[1].match(/wave:\s*(\d+)/);
          if (waveMatch) {
            waves.add(parseInt(waveMatch[1], 10));
          }
        }
      } catch (err) {
        console.warn('[GSD Parser] Error reading PLAN file for waves:', planPath, err);
      }
    }

    // If multiple waves detected, there was parallel execution
    if (waves.size > 1) {
      const waveCount = waves.size;
      for (let i = 0; i < waveCount; i++) {
        agents.push({ type: 'executor', label: `Executor ${i + 1}`, icon: '⚡' });
      }
    }
  }

  return agents;
}

/**
 * Extract commit markers from SUMMARY file
 *
 * @param {string} summaryPath - Path to SUMMARY.md file
 * @returns {Array} Array of commit objects with hash and description
 */
function extractCommitMarkers(summaryPath) {
  const commits = [];

  try {
    const content = fs.readFileSync(summaryPath, 'utf8');

    // Look for commits in frontmatter
    const frontmatter = content.match(/^---\n([\s\S]*?)\n---/);
    if (frontmatter) {
      // Try to find commits in key-files section
      const commitMatch = frontmatter[1].match(/commits:\s*\n((?:\s*-\s*.+\n)*)/);
      if (commitMatch) {
        const commitLines = commitMatch[1].trim().split('\n');
        for (const line of commitLines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('-')) {
            const commit = trimmed.replace(/^-\s*/, '').trim();
            // Extract hash and description (format: "abc1234: description")
            const hashMatch = commit.match(/^([a-f0-9]{7,}):?\s*(.*)$/i);
            if (hashMatch) {
              commits.push({
                hash: hashMatch[1],
                description: hashMatch[2] || ''
              });
            }
          }
        }
      }
    }

    // Also look for commits in body (common format: "**Commits:**" section)
    const commitsSection = content.match(/\*\*Commits?:\*\*\s*\n([\s\S]*?)(?=\n\n|\n#|$)/i);
    if (commitsSection) {
      const lines = commitsSection[1].trim().split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('-')) {
          const commit = trimmed.replace(/^-\s*/, '').trim();
          const hashMatch = commit.match(/^([a-f0-9]{7,}):?\s*(.*)$/i);
          if (hashMatch) {
            // Avoid duplicates
            if (!commits.some(c => c.hash === hashMatch[1])) {
              commits.push({
                hash: hashMatch[1],
                description: hashMatch[2] || ''
              });
            }
          }
        }
      }
    }

  } catch (err) {
    console.warn('[GSD Parser] Error reading SUMMARY file for commits:', summaryPath, err);
  }

  return commits;
}

/**
 * Collect ALL project files from .planning and src directories
 *
 * @param {string} projectPath - Absolute path to project root
 * @returns {Array} Array of all file objects
 */
function collectAllProjectFiles(projectPath) {
  const allFiles = [];

  // Helper function to recursively scan directory
  function scanDirectory(dirPath, sourceType) {
    if (!fs.existsSync(dirPath)) return;

    try {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);

        // Skip node_modules, .git, and other common ignore patterns
        if (entry.name === 'node_modules' || entry.name === '.git' ||
            entry.name === 'dist' || entry.name === 'build' || entry.name === 'coverage') {
          continue;
        }

        if (entry.isDirectory()) {
          // Recursively scan subdirectories
          scanDirectory(fullPath, sourceType);
        } else if (entry.isFile()) {
          // Add file to list
          const relativePath = path.relative(projectPath, fullPath);
          const status = getArtifactStatus(fullPath);

          allFiles.push({
            name: entry.name,
            path: fullPath,
            relativePath: relativePath,
            status,
            sourceType: sourceType,
            commits: [] // Could extract commits for SUMMARY files if needed
          });
        }
      }
    } catch (err) {
      console.warn('[GSD Parser] Error scanning directory:', dirPath, err);
    }
  }

  // Scan .planning directory
  const planningPath = path.join(projectPath, '.planning');
  scanDirectory(planningPath, 'planning');

  // Scan src directory
  const srcPath = path.join(projectPath, 'src');
  scanDirectory(srcPath, 'src');

  // Sort files alphabetically
  allFiles.sort((a, b) => a.relativePath.localeCompare(b.relativePath));

  return allFiles;
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

    // Extract commit markers for SUMMARY files
    let commits = [];
    if (file.match(/^\d+-\d+-SUMMARY\.md$/)) {
      commits = extractCommitMarkers(artifactPath);
    }

    artifacts.push({
      name: file,
      path: artifactPath,
      status,
      commits
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
 * @param {Array} allFiles - Array of all project files
 * @returns {Array} Array of stage objects with status
 */
function buildStagesSummary(phases, currentPhase, allFiles = []) {
  const stageSummary = GSD_STAGES.map(stage => ({
    id: stage.id,
    name: stage.name,
    status: 'pending',
    artifacts: [],
    contextUsage: 0,
    parallelAgents: []
  }));

  // Aggregate artifacts, context usage, and parallel agents by stage
  const stageContextUsages = {}; // Track context usage per stage for averaging
  const stageAgents = {}; // Track parallel agents by stage

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

    // Detect parallel agents for this phase
    const agents = detectParallelAgents(phase.directory, phase.stage);
    if (agents.length > 0) {
      if (!stageAgents[phase.stage]) {
        stageAgents[phase.stage] = [];
      }
      // Merge agents (avoid duplicates by type)
      for (const agent of agents) {
        if (!stageAgents[phase.stage].some(a => a.type === agent.type && a.label === agent.label)) {
          stageAgents[phase.stage].push(agent);
        }
      }
    }
  }

  // Add ALL project files to the "Initialize" stage (as a general container)
  // This makes all files visible in the diagram view
  if (allFiles && allFiles.length > 0) {
    const initStageIndex = GSD_STAGES.findIndex(s => s.id === 'initialize');
    if (initStageIndex !== -1) {
      stageSummary[initStageIndex].artifacts.push(...allFiles);
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

  // Set parallel agents per stage
  for (const stageId in stageAgents) {
    const stageIndex = GSD_STAGES.findIndex(s => s.id === stageId);
    if (stageIndex !== -1) {
      stageSummary[stageIndex].parallelAgents = stageAgents[stageId];
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
