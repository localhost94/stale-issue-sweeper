import { throttling } from '@octokit/plugin-throttling';
import { Octokit } from 'octokit';
import { Logger } from '../utils/logger.js';

const logger = new Logger('github-client');

let client: Octokit | null = null;

/**
 * Get the Octokit client (singleton with throttling plugin).
 * Falls back to GITHUB_TOKEN if no Private Key is configured.
 */
export function getClient(token?: string): Octokit {
  if (client) {
    return client;
  }

  const ThrottledOctokit = Octokit.plugin(throttling);

  const auth =
    token ||
    process.env.GITHUB_TOKEN ||
    (process.env.PRIVATE_KEY ? undefined : process.env.GITHUB_TOKEN);

  client = new ThrottledOctokit({
    auth,
    throttle: {
      onRateLimit: (retryAfter: number, options: any) => {
        logger.warn(
          `Rate limit hit on ${options.method} ${options.url}. Retrying after ${retryAfter}s`,
        );
        return true; // retry once
      },
      onSecondaryRateLimit: (_retryAfter: number, options: any) => {
        logger.error(
          `Secondary rate limit on ${options.method} ${options.url}`,
        );
        return false;
      },
    },
  });

  return client;
}

/**
 * Paginated fetch of open issues not updated in `staleDays` days,
 * excluding pull requests and issues with the 'never-stale' label.
 */
export async function getStaleIssues(
  owner: string,
  repo: string,
  staleDays: number,
): Promise<any[]> {
  const octokit = getClient();
  const since = new Date(
    Date.now() - staleDays * 24 * 60 * 60 * 1000,
  ).toISOString();

  const iterator = octokit.paginate.iterator(octokit.rest.issues.listForRepo, {
    owner,
    repo,
    state: 'open',
    since,
    per_page: 100,
  });

  const issues: any[] = [];

  for await (const { data } of iterator) {
    for (const issue of data) {
      // Skip pull requests
      if (issue.pull_request) {
        continue;
      }

      // Skip issues with 'never-stale' label
      const labels = issue.labels.map((l: any) =>
        typeof l === 'string' ? l : l.name,
      );
      if (labels.includes('never-stale')) {
        continue;
      }

      issues.push(issue);
    }
  }

  return issues;
}

/**
 * Fetch the content of a file at a specific ref (commit SHA or branch).
 * Returns the decoded content as a string, or null if the file doesn't exist.
 */
export async function getFileAtRef(
  owner: string,
  repo: string,
  path: string,
  ref: string,
): Promise<string | null> {
  const octokit = getClient();

  try {
    const response = await octokit.rest.repos.getContent({
      owner,
      repo,
      path,
      ref,
    });

    const data = response.data as any;

    if (data.type === 'file' && data.content) {
      return Buffer.from(data.content, 'base64').toString('utf-8');
    }

    return null;
  } catch (error: any) {
    if (error.status === 404) {
      return null;
    }
    throw error;
  }
}
