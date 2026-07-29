import { createApp } from './app';
import { env, assertProductionEnv } from '@/config/env';
import { logger } from '@/config/logger';

assertProductionEnv();

const app = createApp();

app.listen(env.port, () => {
  logger.info(`LeatherConnect API listening on port ${env.port}`);
});
