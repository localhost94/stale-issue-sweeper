import { Probot } from 'probot';
import { loadConfig } from './config.js';
import { Sweeper } from './sweeper.js';
import { Logger } from './utils/logger.js';

const logger = new Logger('app');

/**
 * Probot v13 application function.
 *
 * Handles three event triggers:
 *   1. `issues.labeled` — triggered when a "stale" label is added
 *   2. `issue_comment.created` — triggered by "/sweep-stale" command comment
 *   3. `POST /trigger-sweep` — HTTP endpoint for external cron triggers
 */
export default (app: Probot, { getRouter }: { getRouter?: (path?: string) => any } = {}): void => {
  app.on('issues.labeled', async (ctx: any) => {
    const config = loadConfig();
    const labelName = ctx.payload.label?.name;

    if (labelName !== config.labelStale) {
      return;
    }

    const { owner, repo } = parseRepo(ctx.payload.repository);
    const issue = ctx.payload.issue;
    const sweeper = new Sweeper();

    logger.info(
      `Labeled event: stale label added to ${owner}/${repo}#${issue.number}`,
    );
    await sweeper.analyzeIssue(ctx, config, owner, repo, issue as any);
  });

  app.on('issue_comment.created', async (ctx: any) => {
    const commentBody = ctx.payload.comment.body?.trim() ?? '';
    const command = '/sweep-stale';

    if (!commentBody.startsWith(command)) {
      return;
    }

    const config = loadConfig();
    const { owner, repo } = parseRepo(ctx.payload.repository);
    const sweeper = new Sweeper();

    logger.info(
      `Command triggered: /sweep-stale on ${owner}/${repo} by @${ctx.payload.comment.user.login}`,
    );
    await sweeper.scanRepo(ctx, config, owner, repo);
  });

  // Custom route for external cron trigger
  if (getRouter) {
    const router = getRouter('/trigger-sweep');
    router.post('/', async (req: any, res: any) => {
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
  }
};

function parseRepo(repository: any) {
  return {
    owner: repository.owner.login,
    repo: repository.name,
  };
}
