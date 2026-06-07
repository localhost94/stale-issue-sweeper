import { Probot, Server } from 'probot';
import app from './app.js';

async function main() {
  const ProbotWithDefaults = Probot.defaults({
    appId: Number(process.env.APP_ID) || undefined,
    privateKey: process.env.PRIVATE_KEY || undefined,
    secret: process.env.WEBHOOK_SECRET || 'development',
  });

  const server = new Server({
    Probot: ProbotWithDefaults as unknown as typeof Probot,
    port: Number(process.env.PORT) || 3000,
  });

  await server.load(app);
  await server.start();
}

main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
