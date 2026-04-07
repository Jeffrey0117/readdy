'use strict';

const http = require('node:http');
const path = require('node:path');
const { openDb } = require('./db');
const { handle } = require('./router');

const PORT = parseInt(process.env.PORT || '4022', 10);
const DB_PATH = path.join(__dirname, 'data', 'readdy.db');

const db = openDb(DB_PATH);

const server = http.createServer(async (req, res) => {
  try {
    await handle(req, res, db);
  } catch (err) {
    console.error('[readdy]', req.method, req.url, '→', err.message);
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'server error' }));
    }
  }
});

function shutdown(signal) {
  console.log(`[readdy] received ${signal}, shutting down…`);
  server.close(() => {
    try { db.close(); } catch {}
    process.exit(0);
  });
  // Hard exit if close hangs
  setTimeout(() => process.exit(1), 5000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

server.listen(PORT, () => {
  console.log(`[readdy] listening on http://localhost:${PORT}`);
});
