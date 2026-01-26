const path = require('path');
const { parseRoadmap } = require('../roadmap-parser');

describe('roadmap-parser', () => {
  const fixturesPath = path.join(__dirname, 'fixtures');

  describe('parseRoadmap', () => {
    it('should parse phase information correctly', () => {
      const result = parseRoadmap(fixturesPath);

      expect(result.phases).toHaveLength(3);

      // Verify Phase 1
      const phase1 = result.phases[0];
      expect(phase1.id).toBe('phase-1');
      expect(phase1.number).toBe(1);
      expect(phase1.name).toBe('Foundation');
      expect(phase1.goal).toBe('Establish the foundational architecture for the GSD viewer');
      // Phase 1 is marked complete in overview checkbox, and has some complete plans
      // The status detection prioritizes overview checkbox (complete), then checks if any plans are complete (in-progress)
      // Since overview has it checked, status is 'complete'
      expect(phase1.status).toBe('complete');

      // Verify Phase 2
      const phase2 = result.phases[1];
      expect(phase2.id).toBe('phase-2');
      expect(phase2.number).toBe(2);
      expect(phase2.name).toBe('Graph Rendering');
      expect(phase2.status).toBe('pending');

      // Verify Phase 3
      const phase3 = result.phases[2];
      expect(phase3.id).toBe('phase-3');
      expect(phase3.number).toBe(3);
      expect(phase3.name).toBe('Interactivity');
    });

    it('should extract plans with correct status', () => {
      const result = parseRoadmap(fixturesPath);

      const phase1 = result.phases[0];
      expect(phase1.plans).toHaveLength(3);

      // Verify complete plan
      const plan1 = phase1.plans[0];
      expect(plan1.id).toBe('plan-01-01');
      expect(plan1.file).toBe('01-01-PLAN.md');
      expect(plan1.name).toBe('01-01-PLAN.md');
      expect(plan1.description).toBe('Initialize project structure');
      expect(plan1.status).toBe('complete');

      // Verify pending plan
      const plan3 = phase1.plans[2];
      expect(plan3.id).toBe('plan-01-03');
      expect(plan3.status).toBe('pending');
    });

    it('should determine phase status from overview checkboxes', () => {
      const result = parseRoadmap(fixturesPath);

      // Phase 1 is marked complete in overview checkbox
      expect(result.phases[0].status).toBe('complete');

      // Phase 2 is not marked complete and has no complete plans
      expect(result.phases[1].status).toBe('pending');
    });

    it('should sort phases by number', () => {
      const result = parseRoadmap(fixturesPath);

      expect(result.phases[0].number).toBe(1);
      expect(result.phases[1].number).toBe(2);
      expect(result.phases[2].number).toBe(3);
    });

    it('should return error if ROADMAP.md not found', () => {
      const result = parseRoadmap('/nonexistent/path');

      expect(result.error).toBe('ROADMAP.md not found');
      expect(result.phases).toEqual([]);
    });

    it('should handle phases without plans', () => {
      const result = parseRoadmap(fixturesPath);

      const phase3 = result.phases[2];
      expect(phase3.plans).toHaveLength(1);
    });

    it('should handle plans without descriptions', () => {
      const result = parseRoadmap(fixturesPath);

      const phase2 = result.phases[1];
      const plans = phase2.plans;

      // All plans should have been parsed even if description is empty
      expect(plans.length).toBeGreaterThan(0);
    });
  });
});
