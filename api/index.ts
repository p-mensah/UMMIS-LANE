import app, { initDb } from '../server';

export default function handler(req: any, res: any) {
  try {
    initDb();
  } catch (e) {
    console.error('Serverless initDb error:', e);
  }

  // Restore path if Vercel rewrite or proxy modified req.url
  if (req.headers && req.headers['x-matched-path']) {
    req.url = req.headers['x-matched-path'];
  } else if (req.headers && req.headers['x-now-route-matches']) {
    try {
      const matchQuery = new URLSearchParams(req.headers['x-now-route-matches']);
      const capturedPath = matchQuery.get('1') || matchQuery.get('0');
      if (capturedPath) {
        req.url = `/api/${capturedPath}`;
      }
    } catch {}
  } else if (req.query && (req.query['0'] || req.query['1'])) {
    const subpath = req.query['1'] || req.query['0'];
    const pathStr = Array.isArray(subpath) ? subpath.join('/') : subpath;
    req.url = `/api/${pathStr}`;
  }

  return app(req, res);
}


