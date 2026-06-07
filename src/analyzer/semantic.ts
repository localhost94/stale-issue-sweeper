import { AppConfig } from '../config.js';
import { getClient, getFileAtRef } from '../github/client.js';
import { Logger } from '../utils/logger.js';

const logger = new Logger('semantic');

/**
 * Result of analyzing an issue's semantic relevance.
 */
export interface AnalysisResult {
  /** Whether the issue appears to be fixed in recent commits */
  isFixed: boolean;
  /** Whether the issue is stale (no meaningful recent activity) */
  isStale: boolean;
  /** Confidence score 0.0–1.0 */
  confidence: number;
  /** Human-readable summary of the analysis */
  summary: string;
  /** List of related commit SHA or file changes */
  relatedChanges: string[];
}

/** Input shape for issue analysis. */
export interface IssueInput {
  title: string;
  body: string;
  number: number;
}

/**
 * Extract meaningful keywords from text, discarding stopwords
 * and words shorter than 3 characters.
 */
export function extractKeywords(text: string): string[] {
  const stopwords = new Set([
    'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can',
    'had', 'her', 'was', 'one', 'our', 'out', 'has', 'have', 'been',
    'some', 'them', 'than', 'that', 'this', 'very', 'just', 'with',
    'will', 'each', 'made', 'like', 'which', 'they', 'been', 'have',
    'from', 'what', 'when', 'where', 'your', 'their', 'about', 'into',
    'over', 'such', 'only', 'other', 'more', 'also', 'how', 'its',
    'may', 'these', 'would', 'should', 'could', 'does', 'doing',
    'done', 'being', 'after', 'then', 'there', 'here', 'than', 'then',
    'both', 'each', 'few', 'most', 'same', 'too', 'very', 'just',
    'because', 'before', 'between', 'under', 'while', 'without',
    'another', 'every', 'either', 'neither', 'enough', 'own', 'rather',
    'whether', 'although', 'though', 'until', 'upon', 'within',
    'along', 'around', 'behind', 'below', 'beneath', 'beside',
    'beyond', 'during', 'except', 'inside', 'outside', 'since',
    'through', 'throughout', 'toward', 'towards', 'underneath',
    'upon', 'whatever', 'whenever', 'wherever', 'whichever',
    'whoever', 'whomever',
  ]);

  const words = text.toLowerCase().match(/\b[a-z]{3,}\b/g) || [];
  return [...new Set(words.filter((w) => !stopwords.has(w)))];
}

/**
 * Fetch commits made since the given date for a repository.
 */
export async function fetchCommitsSince(
  owner: string,
  repo: string,
  since: string,
): Promise<any[]> {
  const octokit = getClient();

  try {
    const { data } = await octokit.rest.repos.listCommits({
      owner,
      repo,
      since,
      per_page: 100,
    });

    return data;
  } catch (error: any) {
    logger.warn(`Failed to fetch commits for ${owner}/${repo}: ${error.message}`);
    return [];
  }
}

/**
 * Filter commits that match issue keywords in their messages.
 */
export function filterRelevantCommits(
  commits: any[],
  title: string,
  body: string,
): any[] {
  const combined = `${title} ${body}`;
  const keywords = extractKeywords(combined);
  const keywordSet = new Set(keywords);

  return commits.filter((commit) => {
    const message = (commit.commit?.message ?? '').toLowerCase();
    return [...keywordSet].some((kw) => message.includes(kw));
  });
}

/**
 * Fallback heuristic analysis when no LLM is available.
 *
 * Checks if any recent commit messages contain fix/resolve keywords
 * and match issue keywords.
 */
export function heuristicAnalysis(
  title: string,
  body: string,
  commits: any[],
): AnalysisResult {
  const relevantCommits = filterRelevantCommits(commits, title, body);

  if (relevantCommits.length === 0) {
    return {
      isFixed: false,
      isStale: true,
      confidence: 0.3,
      summary:
        'No recent commits found matching the issue keywords. The issue may still be open.',
      relatedChanges: [],
    };
  }

  const fixKeywords = ['fix', 'fixes', 'fixed', 'resolve', 'resolves', 'resolved', 'close', 'closes', 'closed', 'patch'];
  const hasFixCommit = relevantCommits.some((c) => {
    const msg = (c.commit?.message ?? '').toLowerCase();
    return fixKeywords.some((kw) => msg.includes(kw));
  });

  const shaList = relevantCommits.map(
    (c) => c.sha?.slice(0, 7) ?? 'unknown',
  );

  if (hasFixCommit) {
    return {
      isFixed: true,
      isStale: false,
      confidence: 0.75,
      summary: `Found ${relevantCommits.length} relevant commit(s) containing fix keywords. Issue may be resolved.`,
      relatedChanges: shaList,
    };
  }

  return {
    isFixed: false,
    isStale: false,
    confidence: 0.5,
    summary: `Found ${relevantCommits.length} related commit(s) but none contain fix keywords. Further investigation needed.`,
    relatedChanges: shaList,
  };
}

/**
 * Build a prompt for an LLM to analyze whether an issue is stale or fixed.
 */
export function buildAnalysisPrompt(
  title: string,
  body: string,
  commits: any[],
): string {
  const commitMessages = commits
    .map((c, i) => `${i + 1}. ${c.sha?.slice(0, 7)}: ${c.commit?.message ?? ''}`)
    .join('\n');

  return `You are analyzing a GitHub issue to determine if it has been resolved.

ISSUE TITLE: ${title}
ISSUE BODY: ${body}

RECENT COMMITS (up to ${commits.length}):
${commitMessages || 'No recent commits available.'}

Determine:
1. Has this issue been FIXED by recent commits? (yes/no)
2. What is your CONFIDENCE level (0.0–1.0)?
3. Provide a short SUMMARY of your reasoning.

Respond in this exact format:
FIXED: yes/no
CONFIDENCE: 0.0-1.0
SUMMARY: your summary here`;
}

/**
 * Parse an LLM response into an AnalysisResult.
 */
export function parseLLMResponse(text: string): Partial<AnalysisResult> {
  const result: Partial<AnalysisResult> = {
    isFixed: false,
    confidence: 0,
    summary: '',
  };

  const fixedMatch = text.match(/FIXED:\s*(yes|no)/i);
  if (fixedMatch) {
    result.isFixed = fixedMatch[1].toLowerCase() === 'yes';
  }

  const confidenceMatch = text.match(/CONFIDENCE:\s*([0-9]*\.?[0-9]+)/i);
  if (confidenceMatch) {
    result.confidence = Math.min(1, Math.max(0, parseFloat(confidenceMatch[1])));
  }

  const summaryMatch = text.match(/SUMMARY:\s*(.+)/is);
  if (summaryMatch) {
    result.summary = summaryMatch[1].trim();
  }

  return result;
}

/**
 * Main analysis entry point.
 *
 * Uses heuristic analysis (keyword + commit message matching) by default.
 * If LLM provider is 'openai', constructs and sends a prompt (not fully
 * implemented here - requires OpenAI SDK integration).
 */
export async function analyzeIssue(
  issue: IssueInput,
  owner: string,
  repo: string,
  config: AppConfig,
): Promise<AnalysisResult> {
  // Calculate date range for fetching commits
  const since = new Date(
    Date.now() - config.staleDays * 24 * 60 * 60 * 1000,
  ).toISOString();

  const commits = await fetchCommitsSince(owner, repo, since);

  if (config.llmProvider === 'openai') {
    const prompt = buildAnalysisPrompt(issue.title, issue.body, commits);
    // LLM integration placeholder: actual OpenAI call would go here.
    // For now, falls through to heuristic analysis.
    logger.warn(
      'OpenAI provider selected but not fully implemented; using heuristic fallback.',
    );
  }

  const analysis = heuristicAnalysis(issue.title, issue.body, commits);
  logger.info(
    `Analysis for issue #${issue.number}: confidence=${analysis.confidence}, fixed=${analysis.isFixed}`,
  );
  return analysis;
}
