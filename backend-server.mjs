import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';

const dev = process.env.NODE_ENV !== 'production';
const hostname = '0.0.0.0';
const port = process.env.PORT || 4111;

// Only run the API routes, not the full Next.js app
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

console.log('🚀 Starting Finance Backend Server...');
console.log(`📍 Environment: ${dev ? 'development' : 'production'}`);
console.log(`🌐 Port: ${port}`);

app.prepare().then(() => {
  createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);

      // Only handle API routes
      if (parsedUrl.pathname.startsWith('/api/')) {
        console.log(`📥 API Request: ${req.method} ${parsedUrl.pathname}`);
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
