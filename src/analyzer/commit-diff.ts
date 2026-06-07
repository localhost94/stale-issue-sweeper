import { getClient, getFileAtRef } from '../github/client.js';
import { Logger } from '../utils/logger.js';

const logger = new Logger('commit-diff');

/**
 * Result of comparing a file's content at two points in time.
 */
export interface FileDiff {
  filePath: string;
  changed: boolean;
  originalSha: string | null;
  currentSha: string | null;
}

/**
 * Compare file content at issue creation time vs. current state.
 * Returns a FileDiff indicating whether the file has changed.
 */
export async function compareFileHistory(
  owner: string,
  repo: string,
  filePath: string,
  createdAt: string,
): Promise<FileDiff> {
  const octokit = getClient();

  // Try to get current file content
  let currentSha: string | null = null;
  let originalSha: string | null = null;

  try {
    const current = await octokit.rest.repos.getContent({
      owner,
      repo,
      path: filePath,
    });
    currentSha = (current.data as any).sha ?? null;
  } catch {
    // File may have been deleted
    currentSha = null;
  }

  // Try to get file content at the time the issue was created
  // Use the commit list to find a commit around the creation date
  try {
    const { data: commits } = await octokit.rest.repos.listCommits({
      owner,
      repo,
      until: createdAt,
      per_page: 1,
    });

    if (commits.length > 0) {
      const ref = commits[0].sha;
      const original = await getFileAtRef(owner, repo, filePath, ref);
      if (original !== null) {
        // We can't get SHA from this method directly, mark as known
        originalSha = 'known-change';
      }
    }
  } catch {
    originalSha = null;
  }

  const changed = currentSha !== originalSha || currentSha === null !== (originalSha === null);

  return {
    filePath,
    changed,
    originalSha,
    currentSha,
  };
}

/**
 * Extract file path references from an issue body (e.g., paths in markdown
 * code blocks, inline paths like `src/main.ts`, or GitHub file links).
 */
export function extractIssueFileRefs(body: string): string[] {
  const refs: string[] = [];

  // Match inline code paths like `src/main.ts` or `path/to/file.py`
  const inlineCodePattern = /`([a-zA-Z0-9_./-]+\.[a-zA-Z0-9]+)`/g;
  let match: RegExpExecArray | null;

  while ((match = inlineCodePattern.exec(body)) !== null) {
    const path = match[1].trim();
    // Filter out obviously non-file paths (URLs, etc.)
    if (
      !path.startsWith('http') &&
      !path.startsWith('#') &&
      path.includes('.')
    ) {
      refs.push(path);
    }
  }

  // Match GitHub file links
  const gitHubFilePattern =
    /github\.com\/[\w.-]+\/[\w.-]+\/blob\/[\w.-]+\/([\w./-]+)/g;
  while ((match = gitHubFilePattern.exec(body)) !== null) {
    refs.push(match[1]);
  }

  return [...new Set(refs)];
}

/**
 * Diff all files referenced in an issue body.
 * Returns an array of FileDiff results.
 */
export async function diffIssueFiles(
  issue: { body: string; created_at?: string },
  owner: string,
  repo: string,
): Promise<FileDiff[]> {
  const filePaths = extractIssueFileRefs(issue.body || '');
  const createdAt = issue.created_at ?? new Date().toISOString();

  if (filePaths.length === 0) {
    logger.info('No file references found in issue body');
    return [];
  }

  logger.info(`Found ${filePaths.length} file references in issue body`);

  const results: FileDiff[] = [];

  for (const filePath of filePaths) {
    try {
      const diff = await compareFileHistory(owner, repo, filePath, createdAt);
      results.push(diff);
      logger.info(`  ${filePath}: ${diff.changed ? 'CHANGED' : 'unchanged'}`);
    } catch (error: any) {
      logger.warn(`  ${filePath}: error — ${error.message}`);
    }
  }

  return results;
}
