import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import type { Env } from './types';

// Import routes
import auth from './routes/auth';
import transactions from './routes/transactions';
import upload from './routes/upload';
import dashboard from './routes/dashboard';
import admin from './routes/admin';
import chat from './routes/chat';
import dev from './routes/dev';
import documents from './routes/documents';

const app = new Hono<{ Bindings: Env }>();

// Global middleware
app.use('*', logger());
app.use('*', cors({
  origin: (origin) => {
    // Allow localhost for development
    if (origin?.startsWith('http://localhost')) return origin;
    // Allow all Pages deployments (including preview URLs)
    if (origin?.endsWith('.tax-pre-process.pages.dev')) return origin;
    if (origin === 'https://tax-pre-process.pages.dev') return origin;
    // Allow custom domains
    if (origin === 'https://japantpp.com') return origin;
    if (origin === 'https://www.japantpp.com') return origin;
    return null;
  },
  credentials: true,
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

// Health check
app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes
app.route('/api/auth', auth);
app.route('/api/transactions', transactions);
app.route('/api/upload', upload);
app.route('/api/dashboard', dashboard);
app.route('/api/admin', admin);
app.route('/api/chat', chat);
app.route('/api/dev', dev); // Development only routes
app.route('/api/documents', documents);

// 404 handler
app.notFound((c) => {
  return c.json({ error: 'Not Found' }, 404);
});

// Error handler
app.onError((err, c) => {
  console.error('Error:', err);
  return c.json({ error: 'Internal Server Error' }, 500);
});

export default app;
