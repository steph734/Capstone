// One-off dev script (run directly with `node`, same pattern as the
// migrate-*.js scripts in this folder) that every 2 minutes generates one
// fresh 6-digit code, saves it to `user_otps`, and emails it to the target
// user — so each row you see populate in Compass is exactly the code that
// landed in their inbox. It sends real email every cycle, so don't leave it
// running unattended.
//
// Usage:
//   node seed-user-otps.js                    seed against the first user found
//   node seed-user-otps.js someone@email.com  seed against a specific user
//   node seed-user-otps.js someone@email.com demo   also set a custom purpose
//
// Stop with Ctrl+C.
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
const UserOtp = require('./models/UserOtp');
const { generateCode, OTP_TTL_MS, sendOtpEmail } = require('./utils/otp');

const INTERVAL_MS = 2 * 60 * 1000;

async function main() {
  if (!process.env.MONGO_URI) {
    console.error('MONGO_URI is not set. Create backend/.env (see server.js).');
    process.exit(1);
  }

  const emailArg = process.argv[2];
  const purpose = process.argv[3] || 'seed';

  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB.');

  const user = emailArg
    ? await User.findOne({ email: emailArg.trim().toLowerCase() })
    : await User.findOne().sort({ _id: 1 });

  if (!user) {
    console.error(
      emailArg
        ? `No user found with email "${emailArg}".`
        : 'No users exist yet. Sign up an account first, or pass an email: node seed-user-otps.js someone@example.com'
    );
    await mongoose.disconnect();
    process.exit(1);
  }

  console.log(`Seeding user_otps for ${user.email} (purpose: "${purpose}") every 2 minutes. Press Ctrl+C to stop.`);

  const insertAndSend = async () => {
    const code = generateCode();
    const now = Date.now();
    await UserOtp.create({
      user_id: user._id,
      code,
      purpose,
      otp_created_at: new Date(now),
      otp_expires_at: new Date(now + OTP_TTL_MS),
    });
    await sendOtpEmail({ email: user.email, name: user.full_name, code });
    console.log(`[${new Date().toLocaleTimeString()}] inserted + emailed OTP ${code} to ${user.email}`);
  };

  await insertAndSend();
  const timer = setInterval(() => {
    insertAndSend().catch((err) => console.error('insert/send failed:', err.message));
  }, INTERVAL_MS);

  process.on('SIGINT', async () => {
    clearInterval(timer);
    await mongoose.disconnect();
    console.log('\nStopped seeding.');
    process.exit(0);
  });
}

main().catch((err) => {
  console.error('Seeder failed:', err);
  process.exit(1);
});
