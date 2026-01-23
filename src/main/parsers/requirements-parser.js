const fs = require('fs');
const path = require('path');

/**
 * Parse REQUIREMENTS.md to extract requirements and their phase mappings
 * @param {string} planningPath - Path to .planning/ directory
 * @returns {Object} Parsed requirements data
 */
function parseRequirements(planningPath) {
  const reqPath = path.join(planningPath, 'REQUIREMENTS.md');

  if (!fs.existsSync(reqPath)) {
    return { requirements: [], phaseMapping: {}, error: 'REQUIREMENTS.md not found' };
  }

  const content = fs.readFileSync(reqPath, 'utf-8');
  const requirements = [];
  const phaseMapping = {}; // reqId -> phaseNumber

  // Extract requirements from v1 Requirements section
  // Format: - [ ] **GRF-01**: Description
  // Or: - [x] **GRF-01**: Description
  const reqRegex = /- \[([ x])\] \*\*([A-Z]+-\d+)\*\*:\s*([^\n]+)/g;

  let match;
  while ((match = reqRegex.exec(content)) !== null) {
    const isComplete = match[1] === 'x';
    const reqId = match[2];
    const description = match[3].trim();

    // Determine category from ID prefix
    const category = reqId.split('-')[0];

    requirements.push({
      id: `req-${reqId.toLowerCase()}`,
      code: reqId,
      description: description,
      category: category,
      status: isComplete ? 'complete' : 'pending'
    });
  }

  // Extract phase mappings from Traceability section
  // Format: | GRF-01 | Phase 1 | Pending |
  const traceRegex = /\|\s*([A-Z]+-\d+)\s*\|\s*Phase\s*(\d+)\s*\|/g;

  while ((match = traceRegex.exec(content)) !== null) {
    const reqId = match[1];
    const phaseNum = parseInt(match[2], 10);
    phaseMapping[reqId] = phaseNum;
  }

  return { requirements, phaseMapping };
}

module.exports = { parseRequirements };
