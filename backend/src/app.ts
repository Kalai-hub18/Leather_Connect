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
import { notificationRoutes } from '@/modules/notifications/routes/notification.routes';
import { analyticsRoutes } from '@/modules/analytics/routes/analytics.routes';
import { studentRoutes } from '@/modules/students/routes/student.routes';
import { companyRoutes } from '@/modules/companies/routes/company.routes';

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
  app.use('/api/notifications', notificationRoutes);
  app.use('/api/analytics', analyticsRoutes);
  app.use('/api/students', studentRoutes);
  app.use('/api/companies', companyRoutes);

  app.use(errorHandler);

  return app;
}
