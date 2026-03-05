import { describe, it, expect } from 'vitest';
import { builtInPersonas } from '../personas';
import { provocationType } from '../schema';

describe('personas', () => {
  const personas = Object.values(builtInPersonas);
  const personaIds = Object.keys(builtInPersonas);

  it('should define all persona types from schema', () => {
    for (const id of provocationType) {
      expect(builtInPersonas[id], `Missing persona definition for "${id}"`).toBeDefined();
    }
  });

  it('should have no duplicate IDs', () => {
    const unique = new Set(personaIds);
    expect(unique.size).toBe(personaIds.length);
  });

  describe.each(personas)('persona "$id"', (persona) => {
    it('should have required identity fields', () => {
      expect(persona.id).toBeTruthy();
      expect(persona.label).toBeTruthy();
      expect(persona.role).toBeTruthy();
      expect(persona.description).toBeTruthy();
      expect(persona.icon).toBeTruthy();
    });

    it('should have valid color definition', () => {
      expect(persona.color).toBeDefined();
      expect(persona.color.text).toBeTruthy();
      expect(persona.color.bg).toBeTruthy();
      expect(persona.color.accent).toBeTruthy();
    });

    it('should have both challenge and advice prompts', () => {
      expect(persona.prompts).toBeDefined();
      expect(persona.prompts.challenge.length).toBeGreaterThan(50);
      expect(persona.prompts.advice.length).toBeGreaterThan(50);
    });

    it('should have challenge and advice summaries', () => {
      expect(persona.summary).toBeDefined();
      expect(persona.summary.challenge).toBeTruthy();
      expect(persona.summary.advice).toBeTruthy();
    });

    it('should have a valid domain', () => {
      expect(['root', 'technology', 'business', 'marketing']).toContain(persona.domain);
    });

    it('should have hierarchy info', () => {
      if (persona.id === 'master_researcher') {
        expect(persona.domain).toBe('root');
      } else {
        expect(persona.parentId).toBeTruthy();
        expect(persona.domain).not.toBe('root');
      }
    });
  });

  it('should have no orphan personas (except root)', () => {
    for (const persona of personas) {
      if (persona.id === 'master_researcher') continue;
      expect(
        persona.parentId,
        `Persona "${persona.id}" has no parentId`,
      ).toBeTruthy();
      // Parent should exist
      if (persona.parentId) {
        expect(
          builtInPersonas[persona.parentId as keyof typeof builtInPersonas],
          `Persona "${persona.id}" references non-existent parent "${persona.parentId}"`,
        ).toBeDefined();
      }
    }
  });

  it('should cover all three domains', () => {
    const domains = new Set(personas.map((p) => p.domain));
    expect(domains).toContain('technology');
    expect(domains).toContain('business');
    expect(domains).toContain('marketing');
  });
});
