import { Octokit } from 'octokit';
import { Logger } from '../utils/logger.js';

const logger = new Logger('label-action');

/** Standard labels used by the sweeper. */
interface SweepLabel {
  name: string;
  color: string;
  description: string;
}

const REQUIRED_LABELS: SweepLabel[] = [
  {
    name: 'still-relevant',
    color: '2ecc71',
    description: 'Issue confirmed as still relevant by auto-sweeper',
  },
  {
    name: 'needs-more-info',
    color: 'f1c40f',
    description: 'Issue needs more information to determine relevance',
  },
  {
    name: 'auto-swept',
    color: '9b59b6',
    description: 'Issue was analyzed by the stale-issue-sweeper',
  },
];

/**
 * Ensure required labels exist in the repository.
 * Creates any that are missing.
 */
export async function ensureLabels(
  octokit: Octokit,
  owner: string,
  repo: string,
): Promise<void> {
  for (const label of REQUIRED_LABELS) {
    try {
      await octokit.rest.issues.getLabel({
        owner,
        repo,
        name: label.name,
      });
    } catch (error: any) {
      if (error.status === 404) {
        logger.info(`Creating label: "${label.name}"`);
        await octokit.rest.issues.createLabel({
          owner,
          repo,
          name: label.name,
          color: label.color,
          description: label.description,
        });
      } else {
        logger.warn(
          `Error checking label "${label.name}": ${error.message}`,
        );
      }
    }
  }
}

/**
 * Add a sweep-related label to an issue.
 * Also adds the 'auto-swept' label to track that the sweeper processed it.
 */
export async function addSweepLabel(
  octokit: Octokit,
  owner: string,
  repo: string,
  issueNumber: number,
  label: string,
): Promise<void> {
  const labels = [label, 'auto-swept'];

  await octokit.rest.issues.addLabels({
    owner,
    repo,
    issue_number: issueNumber,
    labels,
  });

  logger.info(`Added labels [${labels.join(', ')}] to issue #${issueNumber}`);
}
