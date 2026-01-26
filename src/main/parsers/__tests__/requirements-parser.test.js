const path = require('path');
const { parseRequirements } = require('../requirements-parser');

describe('requirements-parser', () => {
  const fixturesPath = path.join(__dirname, 'fixtures');

  describe('parseRequirements', () => {
    it('should parse requirements with correct properties', () => {
      const result = parseRequirements(fixturesPath);

      expect(result.requirements.length).toBeGreaterThan(0);

      // Verify a complete requirement
      const grf01 = result.requirements.find(r => r.code === 'GRF-01');
      expect(grf01).toBeDefined();
      expect(grf01.id).toBe('req-grf-01');
      expect(grf01.description).toBe('Display project structure as 3D graph');
      expect(grf01.category).toBe('GRF');
      expect(grf01.status).toBe('complete');

      // Verify a pending requirement
      const grf02 = result.requirements.find(r => r.code === 'GRF-02');
      expect(grf02).toBeDefined();
      expect(grf02.status).toBe('pending');
    });

    it('should extract phase mappings from traceability table', () => {
      const result = parseRequirements(fixturesPath);

      expect(result.phaseMapping['GRF-01']).toBe(1);
      expect(result.phaseMapping['GRF-02']).toBe(2);
      expect(result.phaseMapping['UI-01']).toBe(3);
      expect(result.phaseMapping['FSI-01']).toBe(1);
    });

    it('should categorize requirements by ID prefix', () => {
      const result = parseRequirements(fixturesPath);

      const grfReqs = result.requirements.filter(r => r.category === 'GRF');
      const uiReqs = result.requirements.filter(r => r.category === 'UI');
      const fsiReqs = result.requirements.filter(r => r.category === 'FSI');

      expect(grfReqs.length).toBe(3);
      expect(uiReqs.length).toBe(2);
      expect(fsiReqs.length).toBe(2);
    });

    it('should handle complete and pending requirements', () => {
      const result = parseRequirements(fixturesPath);

      const completeReqs = result.requirements.filter(r => r.status === 'complete');
      const pendingReqs = result.requirements.filter(r => r.status === 'pending');

      expect(completeReqs.length).toBeGreaterThan(0);
      expect(pendingReqs.length).toBeGreaterThan(0);
    });

    it('should return error if REQUIREMENTS.md not found', () => {
      const result = parseRequirements('/nonexistent/path');

      expect(result.error).toBe('REQUIREMENTS.md not found');
      expect(result.requirements).toEqual([]);
      expect(result.phaseMapping).toEqual({});
    });

    it('should generate lowercase IDs from requirement codes', () => {
      const result = parseRequirements(fixturesPath);

      const uiReq = result.requirements.find(r => r.code === 'UI-01');
      expect(uiReq.id).toBe('req-ui-01');
    });

    it('should parse all requirement types', () => {
      const result = parseRequirements(fixturesPath);

      // Should have requirements from all three categories
      expect(result.requirements.length).toBe(7);
    });
  });
});
