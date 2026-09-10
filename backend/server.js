const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();

app.use(cors());
app.use(express.json());

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
