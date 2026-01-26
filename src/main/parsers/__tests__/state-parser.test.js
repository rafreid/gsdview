const path = require('path');
const { parseState } = require('../state-parser');

describe('state-parser', () => {
  const fixturesPath = path.join(__dirname, 'fixtures');

  describe('parseState', () => {
    it('should extract current phase and plan', () => {
      const result = parseState(fixturesPath);

      expect(result.currentPhase).toBe(2);
      expect(result.currentPlan).toBe(1);
    });

    it('should detect in-progress status', () => {
      const result = parseState(fixturesPath);

      expect(result.status).toBe('in-progress');
    });

    it('should extract blockers from Blockers/Concerns section', () => {
      const result = parseState(fixturesPath);

      expect(result.blockers).toHaveLength(2);
      expect(result.blockers[0].description).toBe('Need to optimize graph rendering performance');
      expect(result.blockers[1].description).toBe('Waiting for design review of UI components');
      expect(result.blockers[0].id).toMatch(/^blocker-\d+$/);
    });

    it('should not include "None" as a blocker', () => {
      const result = parseState(fixturesPath);

      const noneBlocker = result.blockers.find(b =>
        b.description.toLowerCase().includes('none')
      );
      expect(noneBlocker).toBeUndefined();
    });

    it('should return error if STATE.md not found', () => {
      const result = parseState('/nonexistent/path');

      expect(result.error).toBe('STATE.md not found');
      expect(result.currentPhase).toBeNull();
      expect(result.currentPlan).toBeNull();
      expect(result.status).toBe('unknown');
      expect(result.blockers).toEqual([]);
    });

    it('should handle different status formats', () => {
      // This test uses the fixture which has "In progress"
      const result = parseState(fixturesPath);
      expect(result.status).toBe('in-progress');

      // The parser should handle:
      // - "complete" -> 'complete'
      // - "in progress" / "executing" -> 'in-progress'
      // - "blocked" -> 'blocked'
      // - "ready" -> 'pending'
    });

    it('should parse todos but only include blocking ones in blockers', () => {
      const result = parseState(fixturesPath);

      // The fixture has 2 todos, but neither contains blocking keywords
      // So they shouldn't be in blockers
      const todosInBlockers = result.blockers.filter(b => b.type === 'todo');

      // Since the fixture todos don't have blocking keywords, should be 0
      expect(todosInBlockers.length).toBe(0);
    });

    it('should assign unique IDs to blockers', () => {
      const result = parseState(fixturesPath);

      const ids = result.blockers.map(b => b.id);
      const uniqueIds = new Set(ids);

      expect(uniqueIds.size).toBe(ids.length);
    });
  });
});
