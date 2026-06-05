'use strict';

const http = require('node:http');
const { openDb } = require('./db');
const { handle } = require('./router');

const PORT = parseInt(process.env.PORT || '4022', 10);

let db = null;

const server = http.createServer(async (req, res) => {
  try {
    if (!db) {
      res.writeHead(503, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify({ error: 'starting up' }));
    }
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
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

(async () => {
  db = await openDb();
  server.listen(PORT, () => {
    console.log(`[readdy] listening on http://localhost:${PORT} (selfize-backed)`);
  });
})();
