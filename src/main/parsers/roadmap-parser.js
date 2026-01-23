const fs = require('fs');
const path = require('path');

/**
 * Parse ROADMAP.md to extract phase and plan hierarchy
 * @param {string} planningPath - Path to .planning/ directory
 * @returns {Object} Parsed roadmap data with phases array
 */
function parseRoadmap(planningPath) {
  const roadmapPath = path.join(planningPath, 'ROADMAP.md');

  if (!fs.existsSync(roadmapPath)) {
    return { phases: [], error: 'ROADMAP.md not found' };
  }

  const content = fs.readFileSync(roadmapPath, 'utf-8');
  const phases = [];

  // Extract phase overview status from the checkbox list
  // Format: - [x] **Phase 1: Foundation** - description
  // Or: - [ ] **Phase 2: Graph Rendering** - description
  const phaseStatusRegex = /- \[([ x])\] \*\*Phase (\d+(?:\.\d+)?): ([^*]+)\*\*/g;
  const phaseStatuses = {};

  let match;
  while ((match = phaseStatusRegex.exec(content)) !== null) {
    const isComplete = match[1] === 'x';
    const phaseNum = match[2];
    phaseStatuses[phaseNum] = isComplete ? 'complete' : 'pending';
  }

  // Extract phase details from ### Phase N: sections
  const phaseDetailRegex = /### Phase (\d+(?:\.\d+)?): ([^\n]+)\n([\s\S]*?)(?=### Phase|\n## |$)/g;

  while ((match = phaseDetailRegex.exec(content)) !== null) {
    const phaseNumber = match[1];
    const phaseName = match[2].trim();
    const phaseContent = match[3];

    // Extract goal
    const goalMatch = phaseContent.match(/\*\*Goal\*\*:\s*([^\n]+)/);
    const goal = goalMatch ? goalMatch[1].trim() : '';

    // Extract plans from the Plans section
    // Format: - [ ] 03-01-PLAN.md — description
    // Or: - [x] 01-01-PLAN.md — description
    const plans = [];
    const planRegex = /- \[([ x])\] (\d+-\d+-PLAN\.md)(?: [—-] (.+))?/g;
    let planMatch;

    while ((planMatch = planRegex.exec(phaseContent)) !== null) {
      const isComplete = planMatch[1] === 'x';
      const planFile = planMatch[2];
      const description = planMatch[3] ? planMatch[3].trim() : '';

      // Extract plan number from filename (e.g., "01-01" from "01-01-PLAN.md")
      const planNumMatch = planFile.match(/(\d+-\d+)/);
      const planId = planNumMatch ? `plan-${planNumMatch[1]}` : `plan-${planFile}`;

      plans.push({
        id: planId,
        file: planFile,
        name: planFile,
        description: description,
        status: isComplete ? 'complete' : 'pending'
      });
    }

    // Determine phase status
    let status = phaseStatuses[phaseNumber] || 'pending';

    // If we have plan info, check if phase is in-progress
    if (status !== 'complete' && plans.some(p => p.status === 'complete')) {
      status = 'in-progress';
    }

    phases.push({
      id: `phase-${phaseNumber}`,
      number: parseFloat(phaseNumber),
      name: phaseName,
      goal: goal,
      status: status,
      plans: plans
    });
  }

  // Sort phases by number
  phases.sort((a, b) => a.number - b.number);

  return { phases };
}

module.exports = { parseRoadmap };
