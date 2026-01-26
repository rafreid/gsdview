---
phase: quick
plan: 013
type: execute
wave: 1
depends_on: []
files_modified:
  - package.json
  - jest.config.js
  - src/main/parsers/__tests__/directory-parser.test.js
  - src/main/parsers/__tests__/roadmap-parser.test.js
  - src/main/parsers/__tests__/requirements-parser.test.js
  - src/main/parsers/__tests__/state-parser.test.js
  - src/main//__tests__/graph-builder.test.js
autonomous: true

must_haves:
  truths:
    - "Jest test runner is configured and runs via npm test"
    - "Parser modules have unit tests covering core functionality"
    - "Tests pass with no mocking of filesystem (use test fixtures)"
  artifacts:
    - path: "jest.config.js"
      provides: "Jest configuration for Node.js environment"
    - path: "src/main/parsers/__tests__/directory-parser.test.js"
      provides: "Tests for directory parsing functions"
    - path: "src/main/parsers/__tests__/roadmap-parser.test.js"
      provides: "Tests for roadmap markdown parsing"
    - path: "src/main/__tests__/graph-builder.test.js"
      provides: "Tests for graph data structure building"
  key_links:
    - from: "package.json"
      to: "jest"
      via: "test script and devDependency"
    - from: "jest.config.js"
      to: "src/**/__tests__/*.test.js"
      via: "testMatch pattern"
---

<objective>
Set up Jest test infrastructure and implement unit tests for the parser modules and graph builder.

Purpose: Enable automated testing of the core parsing and graph-building logic to catch regressions and validate behavior.

Output: Jest configuration, test scripts, and unit tests for all parser modules and the graph builder.
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@src/main/parsers/directory-parser.js
@src/main/parsers/roadmap-parser.js
@src/main/parsers/requirements-parser.js
@src/main/parsers/state-parser.js
@src/main/graph-builder.js
</context>

<tasks>

<task type="auto">
  <name>Task 1: Set up Jest test infrastructure</name>
  <files>package.json, jest.config.js</files>
  <action>
    1. Install Jest as a devDependency: `npm install --save-dev jest`

    2. Create jest.config.js at project root:
       - testEnvironment: 'node' (for CommonJS modules)
       - testMatch: ['**/src/**/__tests__/**/*.test.js']
       - verbose: true
       - collectCoverageFrom: ['src/main/**/*.js', '!**/bundle.js']

    3. Add test scripts to package.json:
       - "test": "jest"
       - "test:watch": "jest --watch"
       - "test:coverage": "jest --coverage"

    Note: Use Node test environment since these are main process modules (not renderer/browser).
  </action>
  <verify>Run `npm test` - should reprt "No tests found" (test runner works but no tests yet)</verify>
  <done>Jest configured, npm test command works, jest.config.js exists</done>
</task>

<task type="auto">
  <name>Task 2: Implement parser unit tests with test fixtures</name>
  <files>
    src/main/parsers/__tests__/directory-parser.test.js
    src/main/parsers/__tests__/roadmap-parser.test.js
    src/main/parsers/__tests__/requirements-parser.test.js
    src/main/parsers/__tests__/state-parser.test.js
    src/main/parsers/__tests__/fixtures/ (test data)
  </files>
  <action>
    Create __tests__ directory in src/main/parsers/ and a fixtures/ subdirectory.

    **directory-parser.test.js:**
    - Test flattenTree() with mock tree structure (pure function, no FS needed)
    - Test parseDirectoryWithSource() by creating temp directories with fs.mkdtempSync
    - Test shouldIgnore logic with various patterns
    - Test ID generation format (sourceType-dir-path, sourceType-file-path)

    **roadmap-parser.test.js:**
    - Create fixtures/ROADMAP.md with sample phase content
    - Test phase extraction (id, number, name, goal, status)
    - Test plan extraction from phase sections
    - Test phase status detection (complete, pending, in-progress)
    - Test error case: file not found returns empty phases

    **requirements-parser.test.js:**
    - Create fixtures/REQUIREMENTS.md with sample requirements
    - Test requirement extraction (id, code, description, category, status)
    - Test phase mapping from traceability section
    - Test error case: file not found

    **state-parser.test.js:**
    - Create fixtures/STATE.md with various state formats
    - Test phase/plan extraction from different formats
    - Test status detection (complete, in-progress, blocked, pending)
    - Test blocker extraction from Blockers/Concerns section
    - Test error case: file not found

    Use Jest's describe/it/expect pattern. Each test should be isolated (no shared state).
  </action>
  <verify>Run `npm test` - all parser tests pass</verify>
  <done>All four parser test files exist with passing tests covering core functionality</done>
</task>

<task type="auto">
  <name>Task 3: Implement graph-builder unit tests</name>
  <files>src/main/__tests__/graph-builder.test.js</files>
  <action>
    Create __tests__ directory in src/main/.

    **graph-builder.test.js:**
    - Test buildGraph() with minimal project data (empty phases, empty requirements)
    - Test project root node is always created
    - Test phase nodes are created with correct properties (id, name, type, status, goal)
    - Test plan nodes are linked to phases
    - Test requirement nodes are created with correct properties
    - Test requirement-to-phase linking via phaseMapping
    - Test directory nodes are added from projectData.directory
    - Test links are created between nodes
    - Test node deduplication (addNode helper)

    Use mock projectData objects - no need to call actual parsers.
    Test both happy paths and edge cases (missing data, empty arrays).
  </action>
  <verify>Run `npm test` - all tests pass including graph-builder tests</verify>
  <done>graph-builder.test.js exists with comprehensive tests, all tests pass</done>
</task>

</tasks>

<verification>
- `npm test` runs successfully with all tests passing
- Test coverage shows parser and graph-builder modules are tested
- No test dependencies on external files outside test fixtures
</verification>

<success_criteria>
- Jest installed and configured
- npm test runs test suite
- Parser tests cover: file parsing, error handling, edge cases
- Graph builder tests cover: node creation, linking, deduplication
- All tests pass (green)
</success_criteria>

<output>
After completion, create `.planning/quick/013-implement-test-suites-for-application/013-SUMMARY.md`
</output>
