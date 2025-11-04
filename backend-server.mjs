import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';

const dev = process.env.NODE_ENV !== 'production';
const hostname = '0.0.0.0';
const port = process.env.PORT || 4111;

// Only run the API routes, not the full Next.js app
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// CORS configuration - allowed origins
const allowedOrigins = [
  'https://agent-challenge-iota.vercel.app',
  'https://agents-backend.trou.hackclub.app',
  'http://localhost:3000',
  process.env.FRONTEND_URL,
].filter(Boolean);

console.log('🚀 Starting Finance Backend Server...');
console.log(`📍 Environment: ${dev ? 'development' : 'production'}`);
console.log(`🌐 Port: ${port}`);
console.log(`🔐 Allowed Origins: ${allowedOrigins.join(', ')}`);

app.prepare().then(() => {
  createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      const origin = req.headers.origin || req.headers.referer;

      // Set CORS headers for all requests
      const isAllowedOrigin = origin && allowedOrigins.some(allowed => origin.includes(allowed) || allowed === origin);

      res.setHeader('Access-Control-Allow-Origin', isAllowedOrigin ? origin : allowedOrigins[0]);
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin, DNT, User-Agent, X-CSRF-Token');
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Max-Age', '86400');

      // Handle preflight OPTIONS request
      if (req.method === 'OPTIONS') {
        console.log(`🔧 CORS preflight from: ${origin}`);
        res.statusCode = 204;
        res.end();
        return;
      }

      // Only handle API routes
      if (parsedUrl.pathname.startsWith('/api/')) {
        console.log(`📥 API Request: ${req.method} ${parsedUrl.pathname} from ${origin || 'unknown'}`);
        await handle(req, res, parsedUrl);
      } else {
        res.statusCode = 404;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({
          error: 'Not Found',
          message: 'This is the backend API server. Only /api/* routes are available.'
        }));
      }
    } catch (err) {
      console.error('❌ Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({
        error: 'Internal Server Error',
        message: err.message
      }));
    }
  })
    .once('error', (err) => {
      console.error('❌ Server error:', err);
      process.exit(1);
    })
    .listen(port, hostname, () => {
      console.log('');
      console.log('✅ Backend server ready!');
      console.log(`🔗 API endpoint: http://${hostname}:${port}/api/copilotkit`);
      console.log('');
      console.log('💡 Available routes:');
      console.log('   - POST /api/copilotkit (CopilotKit runtime)');
      console.log('');
    });
});
