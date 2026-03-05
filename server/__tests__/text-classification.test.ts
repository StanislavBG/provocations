import { describe, it, expect } from 'vitest';
import { classifyInstruction, isLikelyVoiceTranscript } from '../utils/text-classification';

describe('classifyInstruction', () => {
  it('should classify expand instructions', () => {
    expect(classifyInstruction('Add more detail to this section')).toBe('expand');
    expect(classifyInstruction('Expand on the architecture section')).toBe('expand');
    expect(classifyInstruction('Elaborate on the data model')).toBe('expand');
    expect(classifyInstruction('Tell me more about authentication')).toBe('expand');
    expect(classifyInstruction('Flesh out the requirements')).toBe('expand');
  });

  it('should classify condense instructions', () => {
    expect(classifyInstruction('Make it shorter')).toBe('condense');
    expect(classifyInstruction('Condense this section')).toBe('condense');
    expect(classifyInstruction('Be more concise')).toBe('condense');
    expect(classifyInstruction('Trim the introduction')).toBe('condense');
    expect(classifyInstruction('Reduce the length')).toBe('condense');
  });

  it('should classify restructure instructions', () => {
    expect(classifyInstruction('Reorganize the sections')).toBe('restructure');
    expect(classifyInstruction('Move the conclusion up')).toBe('restructure');
    expect(classifyInstruction('Add a new section for testing')).toBe('restructure');
    expect(classifyInstruction('Reorder the bullet points')).toBe('restructure');
  });

  it('should classify clarify instructions', () => {
    expect(classifyInstruction('Simplify the language')).toBe('clarify');
    expect(classifyInstruction('Make it clearer')).toBe('clarify');
    expect(classifyInstruction('This is confusing, fix it')).toBe('clarify');
    expect(classifyInstruction('Make it easier to understand')).toBe('clarify');
  });

  it('should classify style instructions', () => {
    expect(classifyInstruction('Make it more formal')).toBe('style');
    expect(classifyInstruction('Use a professional tone')).toBe('style');
    expect(classifyInstruction('Make it more casual and friendly')).toBe('style');
    expect(classifyInstruction('Adjust the voice')).toBe('style');
  });

  it('should classify correct instructions', () => {
    expect(classifyInstruction('Fix the grammar')).toBe('correct');
    expect(classifyInstruction('Correct the spelling errors')).toBe('correct');
    expect(classifyInstruction('There are typos in paragraph 2')).toBe('correct');
    expect(classifyInstruction('This is wrong, fix the inaccuracies')).toBe('correct');
  });

  it('should classify ambiguous instructions as general', () => {
    expect(classifyInstruction('Make it better')).toBe('general');
    expect(classifyInstruction('Improve the document')).toBe('general');
    expect(classifyInstruction('Polish this')).toBe('general');
  });
});

describe('isLikelyVoiceTranscript', () => {
  it('should detect speech artifacts', () => {
    expect(isLikelyVoiceTranscript(
      'So um basically I was thinking that like you know we should um probably add more testing'
    )).toBe(true);
  });

  it('should detect repeated words', () => {
    expect(isLikelyVoiceTranscript(
      'I think think we should gonna do this and and that kind of thing'
    )).toBe(true);
  });

  it('should not flag clean written text', () => {
    expect(isLikelyVoiceTranscript(
      'The system architecture consists of three layers: presentation, business logic, and data access.'
    )).toBe(false);
  });

  it('should not flag short clean text', () => {
    expect(isLikelyVoiceTranscript('Add error handling')).toBe(false);
  });
});
