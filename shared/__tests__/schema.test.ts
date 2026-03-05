import { describe, it, expect } from 'vitest';
import {
  generateChallengeRequestSchema,
  generateAdviceRequestSchema,
  templateIds,
  provocationType,
  challengeSchema,
  adviceSchema,
} from '../schema';

describe('schema validation', () => {
  describe('generateChallengeRequestSchema', () => {
    it('should accept valid request', () => {
      const result = generateChallengeRequestSchema.safeParse({
        document: 'My document content',
        objective: 'Write a great product spec',
        personaIds: ['architect', 'ceo'],
        appType: 'product-requirement',
      });
      expect(result.success).toBe(true);
    });

    it('should reject empty document', () => {
      const result = generateChallengeRequestSchema.safeParse({
        document: '',
      });
      expect(result.success).toBe(false);
    });

    it('should reject missing document', () => {
      const result = generateChallengeRequestSchema.safeParse({
        objective: 'Some objective',
      });
      expect(result.success).toBe(false);
    });

    it('should accept minimal request (document only)', () => {
      const result = generateChallengeRequestSchema.safeParse({
        document: 'Just a document',
      });
      expect(result.success).toBe(true);
    });

    it('should reject invalid appType', () => {
      const result = generateChallengeRequestSchema.safeParse({
        document: 'Content',
        appType: 'not-a-real-template',
      });
      expect(result.success).toBe(false);
    });

    it('should accept all valid templateIds', () => {
      for (const id of templateIds) {
        const result = generateChallengeRequestSchema.safeParse({
          document: 'Content',
          appType: id,
        });
        expect(result.success, `templateId "${id}" should be valid`).toBe(true);
      }
    });
  });

  describe('generateAdviceRequestSchema', () => {
    it('should accept valid request', () => {
      const result = generateAdviceRequestSchema.safeParse({
        document: 'My document',
        challengeId: 'ch-1',
        challengeTitle: 'Missing error handling',
        challengeContent: 'The document does not address error states.',
        personaId: 'architect',
      });
      expect(result.success).toBe(true);
    });

    it('should reject missing required fields', () => {
      const result = generateAdviceRequestSchema.safeParse({
        document: 'My document',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('templateIds', () => {
    it('should have at least 10 templates', () => {
      expect(templateIds.length).toBeGreaterThanOrEqual(10);
    });

    it('should contain no duplicates', () => {
      const unique = new Set(templateIds);
      expect(unique.size).toBe(templateIds.length);
    });

    it('should all be kebab-case', () => {
      for (const id of templateIds) {
        expect(id).toMatch(/^[a-z][a-z0-9-]*$/);
      }
    });
  });

  describe('provocationType', () => {
    it('should have at least 14 personas', () => {
      expect(provocationType.length).toBeGreaterThanOrEqual(14);
    });

    it('should contain no duplicates', () => {
      const unique = new Set(provocationType);
      expect(unique.size).toBe(provocationType.length);
    });

    it('should include master_researcher', () => {
      expect(provocationType).toContain('master_researcher');
    });
  });
});
