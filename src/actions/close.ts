import { Octokit } from 'octokit';
import { Logger } from '../utils/logger.js';

const logger = new Logger('close-action');

/**
 * Options for auto-closing an issue.
 */
export interface AutoCloseOptions {
  owner: string;
  repo: string;
  issueNumber: number;
  summary: string;
  relatedChanges: string[];
}

/**
 * Safely close an issue with a summary comment.
 *
 * Performs a safety check: verifies the issue is still open before closing.
 */
export async function autoClose(
  octokit: Octokit,
  options: AutoCloseOptions,
): Promise<void> {
  const { owner, repo, issueNumber, summary, relatedChanges } = options;

  // Safety check: verify issue is still open
  const { data: issue } = await octokit.rest.issues.get({
    owner,
    repo,
    issue_number: issueNumber,
  });

  if (issue.state === 'closed') {
    logger.info(
      `Issue #${issueNumber} is already closed. Skipping.`,
    );
    return;
  }

  // Build a summary comment
  const changesList =
    relatedChanges.length > 0
      ? `\n\nRelated changes:\n${relatedChanges.map((s) => `- \`${s}\``).join('\n')}`
      : '';

  const commentBody = [
    '## 🤖 Auto-Sweep Summary',
    '',
    `This issue appears to have been resolved.`,
    '',
    `**Analysis:** ${summary}`,
    changesList,
    '',
    '---',
    '_Auto-closed by [stale-issue-sweeper](https://github.com/localhost94/stale-issue-sweeper)._',
  ]
    .filter(Boolean)
    .join('\n');

  // Post the summary comment
  await octokit.rest.issues.createComment({
    owner,
    repo,
    issue_number: issueNumber,
    body: commentBody,
  });

  // Close the issue
  await octokit.rest.issues.update({
    owner,
    repo,
    issue_number: issueNumber,
    state: 'closed',
    state_reason: 'completed',
  });

  logger.info(
    `Issue #${issueNumber} closed with reason 'completed'.`,
  );
}
