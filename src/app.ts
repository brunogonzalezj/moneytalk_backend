import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { env } from './config/env';
import { errorMiddleware } from './middlewares/error.middleware';
import { notFoundMiddleware } from './middlewares/notFound.middleware';
import apiRouter from './routes';

/** Builds the Express app without listening or starting jobs, so tests can import it. */
export const createApp = () => {
  const app = express();

  // Behind a reverse proxy in production: needed for per-IP rate limits
  if (env.NODE_ENV === 'production') app.set('trust proxy', 1);

  app.disable('x-powered-by');
  app.use(helmet());
  app.use(
    cors({
      origin: env.CORS_ORIGIN,
      // Lets the browser read the export filename
      exposedHeaders: ['Content-Disposition'],
    })
  );
  app.use(express.json({ limit: '100kb' }));

  app.use('/api', apiRouter);

  app.use(notFoundMiddleware);
  app.use(errorMiddleware);

  return app;
};
