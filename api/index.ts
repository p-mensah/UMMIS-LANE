import app, { initDb } from '../server';

export default function handler(req: any, res: any) {
  try {
    initDb();
  } catch (e) {
    console.error('Serverless initDb error:', e);
  }
  return app(req, res);
}

