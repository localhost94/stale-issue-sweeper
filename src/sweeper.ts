import { Context } from 'probot';
import { AppConfig } from './config.js';
import { getClient, getStaleIssues } from './github/client.js';
import { analyzeIssue as analyze } from './analyzer/semantic.js';
import { autoClose } from './actions/close.js';
import { ensureLabels, addSweepLabel } from './actions/label.js';
import { Logger } from './utils/logger.js';

const logger = new Logger('sweeper');

/**
 * Analysis result returned by the semantic analyzer.
 */
export interface AnalysisResult {
  isFixed: boolean;
  isStale: boolean;
  confidence: number;
  summary: string;
  relatedChanges: string[];
}

/**
 * Sweeper orchestrates scanning repos and analyzing stale issues.
 */
export class Sweeper {
  /**
   * Scan an entire repository for stale issues and analyze each one.
   */
  async scanRepo(
    ctx: Context,
    config: AppConfig,
    owner: string,
    repo: string,
  ): Promise<void> {
    const octokit = getClient();
    const staleIssues = await getStaleIssues(owner, repo, config.staleDays);

    logger.info(
      `Scanning ${owner}/${repo}: found ${staleIssues.length} stale issues`,
    );

    const toProcess = staleIssues.slice(0, config.maxIssuesPerRun);

    for (const issue of toProcess) {
      logger.info(`Analyzing issue #${issue.number}: ${issue.title}`);
      await this.analyzeIssue(ctx, config, owner, repo, issue as any);
    }
  }

  /**
   * Analyze a single stale issue using semantic analysis.
   *
   * If confidence >= threshold and the issue is detected as fixed,
   * it is auto-closed with a summary comment.
   * Otherwise, appropriate labels are added.
   */
  async analyzeIssue(
    ctx: Context,
    config: AppConfig,
    owner: string,
    repo: string,
    issue: { number: number; title: string; body: string | null; [key: string]: any },
  ): Promise<void> {
    const octokit = getClient();
    await ensureLabels(octokit, owner, repo);

    const result = await analyze(
      {
        title: issue.title,
        body: issue.body ?? '',
        number: issue.number,
      },
      owner,
      repo,
      config,
    );

    logger.info(
      `Issue #${issue.number}: confidence=${result.confidence.toFixed(2)}, isFixed=${result.isFixed}`,
    );

    if (result.confidence >= config.closeThreshold && result.isFixed) {
      await autoClose(octokit, {
        owner,
        repo,
        issueNumber: issue.number,
        summary: result.summary,
        relatedChanges: result.relatedChanges,
      });
      logger.info(`Issue #${issue.number}: auto-closed (fixed)`);
    } else if (result.confidence >= config.closeThreshold && !result.isFixed) {
      await addSweepLabel(octokit, owner, repo, issue.number, config.labelConfirmed);
      logger.info(
        `Issue #${issue.number}: labeled as still-relevant`,
      );
    } else {
      await addSweepLabel(octokit, owner, repo, issue.number, config.labelNeedsInfo);
      logger.info(
        `Issue #${issue.number}: labeled as needs-more-info`,
      );
    }
  }
}
