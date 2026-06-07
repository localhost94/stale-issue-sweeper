/**
 * Configuration interface for the stale-issue-sweeper app.
 */
export interface AppConfig {
  /** Number of days without activity before an issue is considered stale */
  staleDays: number;
  /** Confidence threshold (0.0–1.0) for auto-closing an issue */
  closeThreshold: number;
  /** Maximum issues to process per scan */
  maxIssuesPerRun: number;
  /** LLM provider: 'openai' or 'local' */
  llmProvider: 'openai' | 'local';
  /** Label name for marking stale issues */
  labelStale: string;
  /** Label name for confirmed still-relevant issues */
  labelConfirmed: string;
  /** Label name for issues needing more info */
  labelNeedsInfo: string;
}

/**
 * Load configuration from environment variables with sensible defaults.
 */
export function loadConfig(): AppConfig {
  return {
    staleDays: parseInt(process.env.STALE_DAYS ?? '60', 10),
    closeThreshold: parseFloat(process.env.CLOSE_THRESHOLD ?? '0.85'),
    maxIssuesPerRun: parseInt(process.env.MAX_ISSUES_PER_RUN ?? '20', 10),
    llmProvider:
      process.env.LLM_PROVIDER === 'openai' ? 'openai' : 'local',
    labelStale: process.env.LABEL_STALE ?? 'stale',
    labelConfirmed: process.env.LABEL_CONFIRMED ?? 'still-relevant',
    labelNeedsInfo: process.env.LABEL_NEEDS_INFO ?? 'needs-more-info',
  };
}
