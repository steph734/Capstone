const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();
const { requireAuth } = require('./lib/session');
const { sanitizeBody, sanitizeQuery } = require('./lib/sanitize');

const app = express();

// So req.ip (used for audit-log entries) reflects the real client address
// when this server runs behind a reverse proxy/load balancer.
app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(helmet());

// Chrome's Private Network Access check adds its own preflight requirement
// on top of normal CORS whenever a public site (like the Vercel-hosted
// frontend) calls a private address like localhost — it sends
// `Access-Control-Request-Private-Network: true` on the OPTIONS preflight
// and refuses the real request unless we explicitly allow it back. This must
// run BEFORE `cors()`, since `cors()` ends the OPTIONS response itself.
app.use((req, res, next) => {
  if (req.headers['access-control-request-private-network']) {
    res.setHeader('Access-Control-Allow-Private-Network', 'true');
  }
  next();
});
// Only our own frontend may call this API from a browser. Set ALLOWED_ORIGINS (comma separated) in backend/.env,
// e.g. https://your-site.vercel.app,http://localhost:5173. Requests with no Origin (curl, server to server) still pass,
// but every private route below also needs a valid session token.
const allowedOrigins = String(process.env.ALLOWED_ORIGINS || 'http://localhost:5173,http://localhost:3000')
  .split(',').map((s) => s.trim()).filter(Boolean);
app.use(cors({
  origin(origin, cb) {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    return cb(null, false);
  },
}));
app.use(express.json({ limit: '1mb' }));
app.use(sanitizeBody);
app.use(sanitizeQuery);

// Brute-force / spam protection. The auth routes can send emails and test passwords, so they get a tight limit.
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many attempts. Please wait a few minutes and try again.' } });
const apiLimiter = rateLimit({ windowMs: 60 * 1000, limit: 300, standardHeaders: true, legacyHeaders: false });
app.use('/api/auth', authLimiter);
app.use('/api/set-password', authLimiter);
app.use('/api/staff-setup', authLimiter);
app.use('/api', apiLimiter);

// Auth: POST /api/auth/signup, POST /api/auth/login
app.use('/api/auth', require('./routes/auth'));

// Staff: GET/POST /api/employees, GET /api/branches
app.use('/api/employees', requireAuth(['Owner', 'Super Admin']), require('./routes/employees'));
app.use('/api/branches', require('./routes/branches'));

// Attendance: POST /api/attendance/scan (webcam badge-scan check-in/out)
app.use('/api/attendance', requireAuth(), require('./routes/attendance'));

// Gamified activities: GET/POST/PATCH/DELETE /api/games (the game catalog —
// Super Admin-authored definitions like Puzzle Pals, Picture-Word Matching)
// Reading the catalog is public (patients play the games); creating/editing/deleting is Super Admin only.
app.use('/api/games', (req, res, next) => (req.method === 'GET' ? next() : requireAuth(['Super Admin'])(req, res, next)), require('./routes/games'));

// Gamified activities: POST/GET /api/game-sessions (per-play activity log,
// separate from the catalog above)
app.use('/api/game-sessions', requireAuth(), require('./routes/gameSessions'));

// Public: new-hire self-setup (set password + upload documents) via emailed invite link
app.use('/api/staff-setup', require('./routes/staffSetup'));

// Public: a hire sets their permanent password via the link from the "You're hired" email
app.use('/api/set-password', require('./routes/setPassword'));

// Super Admin: GET /api/audit-logs (failed-login lockouts, etc.)
app.use('/api/audit-logs', requireAuth(['Super Admin']), require('./routes/auditLogs'));

// In-app email: therapist <-> guardian threads with attachments.
app.use('/api/emails', requireAuth(), require('./routes/emails'));

// Emails staff a reminder 5 minutes before their 8 AM time-in and 5 PM
// time-out, Mon-Fri, skipping anyone who's already scanned for that slot.
require('./jobs/attendanceReminders').startAttendanceReminders();

// Test endpoint — always up, reports live DB status.
app.get('/api/health', (req, res) => {
  const connected = mongoose.connection.readyState === 1;
  res.json({
    message: connected
      ? 'Backend is running and connected!'
      : 'Backend is running, database not connected yet.',
    db: connected ? 'connected' : 'disconnected',
  });
});

const PORT = process.env.PORT || 5000;

if (!process.env.MONGO_URI) {
  console.error('❌ MONGO_URI is not set. Create backend/.env (see step 2).');
  process.exit(1);
}

// Connect to MongoDB Atlas.
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB connected successfully!'))
  .catch((err) => {
    console.error('❌ Database connection error:', err.message);
    if (/whitelist|IP that isn/i.test(err.message)) {
      console.error(
        '   -> Add your current IP in Atlas: Project > Network Access > Add IP Address.'
      );
    }
  });

mongoose.connection.on('disconnected', () => console.warn('⚠️  MongoDB disconnected'));
mongoose.connection.on('reconnected', () => console.log('✅ MongoDB reconnected'));

// Start the HTTP server regardless, so /api/health is reachable while you sort
// out the DB connection.
const httpServer = app.listen(PORT, () => console.log(`🚀 Server listening on port ${PORT}`));

// Without this, a second `node server.js` left running from an earlier
// terminal (common on Windows, where closing a terminal doesn't always kill
// the child process) causes EADDRINUSE here — and since nothing was
// listening for the server's 'error' event, Node re-throws it as an
// unhandled exception whose message is easy to miss in a busy terminal,
// leaving two processes both claiming the port and serving requests
// unpredictably (intermittent 500s that don't reproduce from the code alone).
httpServer.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use — another server.js is likely still running. Stop it (check Task Manager for node.exe) before starting a new one.`);
    process.exit(1);
  }
  throw err;
});
