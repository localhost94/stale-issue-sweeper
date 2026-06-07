import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the GitHub client module before importing Sweeper
vi.mock('../src/github/client.js', () => ({
  getClient: vi.fn(() => ({
    rest: {
      issues: {
        get: vi.fn().mockResolvedValue({
          data: { state: 'open', number: 1, title: 'Test issue', body: 'Test body' },
        }),
        createComment: vi.fn().mockResolvedValue({ data: { id: 1 } }),
        update: vi.fn().mockResolvedValue({ data: { id: 1 } }),
        addLabels: vi.fn().mockResolvedValue({ data: { id: 1 } }),
        getLabel: vi.fn().mockRejectedValue({ status: 404 }),
        createLabel: vi.fn().mockResolvedValue({ data: { id: 1 } }),
      },
      repos: {
        listCommits: vi.fn().mockResolvedValue({ data: [] }),
        getContent: vi.fn().mockRejectedValue({ status: 404 }),
      },
    },
    paginate: {
      iterator: vi.fn().mockReturnValue(
        (async function* () {
          yield { data: [] };
        })(),
      ),
    },
  })),
  getStaleIssues: vi.fn().mockResolvedValue([]),
  getFileAtRef: vi.fn().mockResolvedValue(null),
}));

vi.mock('octokit', () => ({
  Octokit: vi.fn(),
}));

// Mock logger to suppress output during tests
vi.mock('../src/utils/logger.js', () => ({
  Logger: vi.fn().mockImplementation(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}));

import { Sweeper } from '../src/sweeper.js';

describe('Sweeper', () => {
  let sweeper: Sweeper;
  const mockConfig = {
    staleDays: 60,
    closeThreshold: 0.85,
    maxIssuesPerRun: 20,
    llmProvider: 'local' as const,
    labelStale: 'stale',
    labelConfirmed: 'still-relevant',
    labelNeedsInfo: 'needs-more-info',
  };

  beforeEach(() => {
    sweeper = new Sweeper();
    vi.clearAllMocks();
  });

  it('should instantiate correctly', () => {
    expect(sweeper).toBeInstanceOf(Sweeper);
  });

  it('should handle scanRepo with no stale issues', async () => {
    const mockCtx = {} as any;
    await sweeper.scanRepo(mockCtx, mockConfig, 'test-owner', 'test-repo');
    // Should not throw when there are no stale issues
    expect(true).toBe(true);
  });

  it('should handle analyzeIssue gracefully', async () => {
    const mockCtx = {} as any;
    const mockIssue = {
      number: 1,
      title: 'Test issue',
      body: 'This is a test issue body with some keywords',
    };

    await sweeper.analyzeIssue(
      mockCtx,
      mockConfig,
      'test-owner',
      'test-repo',
      mockIssue,
    );
    // Should not throw when analyzing a basic issue
    expect(true).toBe(true);
  });
});
