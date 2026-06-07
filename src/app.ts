import { Probot } from 'probot';
import { loadConfig } from './config.js';
import { Sweeper } from './sweeper.js';
import { Logger } from './utils/logger.js';

const logger = new Logger('app');

/**
 * Create and configure the Probot application.
 *
 * Handles three event triggers:
 *   1. `issues.labeled` — triggered when a "stale" label is added
 *   2. `issue_comment.created` — triggered by "/sweep-stale" command comment
 *   3. `POST /trigger-sweep` — HTTP endpoint for external cron triggers
 */
export const probot = new Probot({
  appId: Number(process.env.APP_ID) || 0,
  privateKey: process.env.PRIVATE_KEY || '',
  webhookSecret: process.env.WEBHOOK_SECRET || '',
  Octokit: undefined,
});

probot.webhook.on('issues.labeled', async (ctx) => {
  const config = loadConfig();
  const labelName = ctx.payload.label?.name;

  if (labelName !== config.labelStale) {
    return;
  }

  const owner = ctx.payload.repository.owner.login;
  const repo = ctx.payload.repository.name;
  const issue = ctx.payload.issue;
  const sweeper = new Sweeper();

  logger.info(
    `Labeled event: stale label added to ${owner}/${repo}#${issue.number}`,
  );
  await sweeper.analyzeIssue(ctx, config, owner, repo, issue as any);
});

probot.webhook.on('issue_comment.created', async (ctx) => {
  const commentBody = ctx.payload.comment.body?.trim() ?? '';
  const command = '/sweep-stale';

  if (!commentBody.startsWith(command)) {
    return;
  }

  const config = loadConfig();
  const owner = ctx.payload.repository.owner.login;
  const repo = ctx.payload.repository.name;
  const sweeper = new Sweeper();

  logger.info(
    `Command triggered: /sweep-stale on ${owner}/${repo} by @${ctx.payload.comment.user.login}`,
  );
  await sweeper.scanRepo(ctx, config, owner, repo);
});

probot.setupServer().then((server) => {
  server.router?.post('/trigger-sweep', async (req, res) => {
    const config = loadConfig();
    const owner = req.body?.owner ?? process.env.DEFAULT_OWNER ?? '';
    const repo = req.body?.repo ?? process.env.DEFAULT_REPO ?? '';

    if (!owner || !repo) {
      res.status(400).json({ error: 'owner and repo are required' });
      return;
    }

    const sweeper = new Sweeper();
    logger.info(`HTTP trigger: /trigger-sweep on ${owner}/${repo}`);
    await sweeper.scanRepo(undefined as any, config, owner, repo);

    res.json({ ok: true, owner, repo });
  });
});
