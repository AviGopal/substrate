import express from 'express';

const app = express();
const PORT = 3000;

// In-memory cache for simple rate limiting
const requestCounts = new Map<string, { count: number; resetAt: number }>();

// Simple in-memory rate limiting middleware
function rateLimitMiddleware(req: express.Request, res: express.Response, next: express.NextFunction) {
  const clientId = req.ip || 'unknown';
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute
  const maxRequests = 10;

  const record = requestCounts.get(clientId);

  if (!record || now > record.resetAt) {
    // New window
    requestCounts.set(clientId, {
      count: 1,
      resetAt: now + windowMs
    });
    next();
  } else if (record.count < maxRequests) {
    // Within limit
    record.count++;
    next();
  } else {
    // Rate limit exceeded
    res.status(429).json({ error: 'Too many requests' });
  }
}

// Apply rate limiting to all routes
app.use(rateLimitMiddleware);

app.get('/', (req, res) => {
  res.json({ message: 'Hello from Express API!' });
});

app.get('/api/status', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    rateLimitInfo: {
      type: 'in-memory',
      window: '60 seconds',
      maxRequests: 10
    }
  });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
