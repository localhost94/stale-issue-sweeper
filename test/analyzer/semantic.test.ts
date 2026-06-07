import { describe, it, expect } from 'vitest';
import {
  extractKeywords,
  heuristicAnalysis,
  parseLLMResponse,
} from '../../src/analyzer/semantic.js';

describe('extractKeywords', () => {
  it('removes stopwords and short words', () => {
    const result = extractKeywords(
      'The quick brown fox jumps over the lazy dog near the river',
    );
    expect(result).not.toContain('the');
    expect(result).not.toContain('over');
    expect(result).toContain('quick');
    expect(result).toContain('brown');
    expect(result).toContain('river');
  });

  it('returns empty array for text with only stopwords', () => {
    const result = extractKeywords('the and for but not you all can');
    expect(result).toEqual([]);
  });

  it('returns empty array for empty or meaningless text', () => {
    expect(extractKeywords('')).toEqual([]);
    expect(extractKeywords('a b c')).toEqual([]);
  });

  it('returns unique keywords only', () => {
    const result = extractKeywords('test test test alpha beta alpha');
    expect(result).toEqual(['test', 'alpha', 'beta']);
  });

  it('handles text with numbers and punctuation', () => {
    const result = extractKeywords('Fix bug #123 in the parser module');
    expect(result).toContain('fix');
    expect(result).toContain('bug');
    expect(result).toContain('parser');
    expect(result).toContain('module');
  });
});

describe('heuristicAnalysis', () => {
  const sampleCommits = [
    {
      sha: 'abc1234567890',
      commit: { message: 'refactor: optimize database query execution' },
    },
    {
      sha: 'def4567890123',
      commit: { message: 'refactor: cleanup database connection pool' },
    },
  ];

  const fixCommits = [
    {
      sha: 'fix001abc',
      commit: { message: 'fix: resolve login timeout issue' },
    },
    {
      sha: 'fix002def',
      commit: { message: 'fixes OAuth login timeout on redirect' },
    },
  ];

  const unrelatedCommits = [
    {
      sha: 'unrel001',
      commit: { message: 'chore: update dependencies' },
    },
    {
      sha: 'unrel002',
      commit: { message: 'docs: update readme' },
    },
  ];

  it('detects fix-related commits', () => {
    const result = heuristicAnalysis(
      'Login issue with OAuth',
      'Users are experiencing login timeouts',
      fixCommits,
    );
    expect(result.isFixed).toBe(true);
    expect(result.confidence).toBeGreaterThanOrEqual(0.7);
    expect(result.relatedChanges).toHaveLength(2);
  });

  it('returns low confidence for unrelated commits', () => {
    const result = heuristicAnalysis(
      'Login issue with OAuth',
      'Users are experiencing login timeouts',
      unrelatedCommits,
    );
    expect(result.isFixed).toBe(false);
    expect(result.confidence).toBeLessThanOrEqual(0.5);
  });

  it('returns stale=true when no relevant commits found', () => {
    const result = heuristicAnalysis('Random feature request', 'Add new color picker', []);
    expect(result.isFixed).toBe(false);
    expect(result.isStale).toBe(true);
    expect(result.confidence).toBe(0.3);
  });

  it('returns moderate confidence for matching but non-fix commits', () => {
    const result = heuristicAnalysis(
      'Database query performance',
      'Slow queries in the users table',
      sampleCommits,
    );
    expect(result.isFixed).toBe(false);
    expect(result.confidence).toBe(0.5);
    expect(result.relatedChanges).toHaveLength(2); // both commits match "database" keywords
  });
});

describe('parseLLMResponse', () => {
  it('parses FIXED: yes with confidence', () => {
    const result = parseLLMResponse(
      'FIXED: yes\nCONFIDENCE: 0.92\nSUMMARY: Recent commit abc123 fixed the login timeout issue.',
    );
    expect(result.isFixed).toBe(true);
    expect(result.confidence).toBeCloseTo(0.92);
    expect(result.summary).toBe(
      'Recent commit abc123 fixed the login timeout issue.',
    );
  });

  it('parses FIXED: no with low confidence', () => {
    const result = parseLLMResponse(
      'FIXED: no\nCONFIDENCE: 0.30\nSUMMARY: No fix commits found in recent history.',
    );
    expect(result.isFixed).toBe(false);
    expect(result.confidence).toBeCloseTo(0.3);
    expect(result.summary).toBe('No fix commits found in recent history.');
  });

  it('handles whitespace variations', () => {
    const result = parseLLMResponse(
      'FIXED:   yes\nCONFIDENCE:   1.0\nSUMMARY:   Definitely fixed.',
    );
    expect(result.isFixed).toBe(true);
    expect(result.confidence).toBeCloseTo(1.0);
    expect(result.summary).toBe('Definitely fixed.');
  });

  it('returns defaults for unrecognized format', () => {
    const result = parseLLMResponse('This is not a valid response format.');
    expect(result.isFixed).toBe(false);
    expect(result.confidence).toBe(0);
    expect(result.summary).toBe('');
  });

  it('clamps confidence to 0..1 range', () => {
    const high = parseLLMResponse('FIXED: yes\nCONFIDENCE: 1.5\nSUMMARY: n/a');
    expect(high.confidence).toBe(1.0);

    const low = parseLLMResponse('FIXED: no\nCONFIDENCE: -0.5\nSUMMARY: n/a');
    expect(low.confidence).toBe(0);
  });
});
