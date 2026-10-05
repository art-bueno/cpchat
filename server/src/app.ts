import express, { type ErrorRequestHandler } from 'express';
import { rateLimit } from 'express-rate-limit';
import helmet from 'helmet';
import { groupsRouter } from './routes/groups.js';
import { notificationsRouter } from './routes/notifications.js';
import { uploadsRouter } from './routes/uploads.js';
import { usersRouter } from './routes/users.js';
import { HttpError } from './utils/guards.js';

export const app = express();

// Render fica atrás de um proxy: necessário para o rate limit enxergar o IP real.
app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(helmet());
app.use(express.json({ limit: '10kb' }));

/** Health check público — usado pelo Render e para verificar disponibilidade durante a correção. */
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', service: 'cpchat-notifications-api', uptimeSeconds: Math.round(process.uptime()), timestamp: new Date().toISOString() });
});

app.get('/', (_req, res) => {
  res.status(200).json({
    service: 'cpchat-notifications-api',
    endpoints: ['GET /health', 'POST /notifications/messages', 'POST /groups/:groupId/sync-members', 'GET /users/:uid/profile', 'POST /uploads/signature'],
  });
});

app.use(rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: 'draft-8', legacyHeaders: false }));

app.use('/notifications', notificationsRouter);
app.use('/groups', groupsRouter);
app.use('/users', usersRouter);
app.use('/uploads', uploadsRouter);

app.use((_req, res) => {
  res.status(404).json({ message: 'Rota não encontrada.' });
});

const errorHandler: ErrorRequestHandler = (error: unknown, _req, res, _next) => {
  if (error instanceof HttpError) {
    res.status(error.status).json({ message: error.message });
    return;
  }
  // Detalhes ficam só no log do servidor; o cliente recebe mensagem genérica.
  console.error('[api] erro inesperado:', error);
  res.status(500).json({ message: 'Erro interno. Tente novamente.' });
};
app.use(errorHandler);
