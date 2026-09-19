const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();

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
app.use(cors());
app.use(express.json());

// Auth: POST /api/auth/signup, POST /api/auth/login
app.use('/api/auth', require('./routes/auth'));

// Staff: GET/POST /api/employees, GET /api/branches
app.use('/api/employees', require('./routes/employees'));
app.use('/api/branches', require('./routes/branches'));

// Public: new-hire self-setup (set password + upload documents) via emailed invite link
app.use('/api/staff-setup', require('./routes/staffSetup'));

// Public: a hire sets their permanent password via the link from the "You're hired" email
app.use('/api/set-password', require('./routes/setPassword'));

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
app.listen(PORT, () => console.log(`🚀 Server listening on port ${PORT}`));
