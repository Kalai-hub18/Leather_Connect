import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import pinoHttp from 'pino-http';
import { randomUUID } from 'crypto';
import { env } from '@/config/env';
import { logger } from '@/config/logger';
import { errorHandler } from '@/middleware/error-handler';
import { authRoutes } from '@/modules/auth/routes/auth.routes';
import { jobRoutes } from '@/modules/jobs/routes/job.routes';
import { applicationRoutes } from '@/modules/applications/routes/application.routes';
import { interviewRoutes } from '@/modules/interviews/routes/interview.routes';

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: env.corsOrigin, credentials: true }));
  app.use(express.json({ limit: '2mb' }));
  app.use(cookieParser());
  app.use(
    pinoHttp({
      logger,
      genReqId: (req) => (req.headers['x-request-id'] as string) ?? randomUUID(),
    }),
  );

  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/jobs', jobRoutes);
  app.use('/api/applications', applicationRoutes);
  app.use('/api/interviews', interviewRoutes);

  app.use(errorHandler);

  return app;
}
