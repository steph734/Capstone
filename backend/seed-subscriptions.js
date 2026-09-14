// One-off dev script (run directly with `node`, same pattern as
// seed-owner-superadmin.js) that upserts the three subscription tiers
// currently implemented in the frontend (SubscriptionPage.jsx /
// OwnerSubscriptionPage.jsx / TherapistSubscriptionPage.jsx) into the
// `subscriptions` collection. Safe to re-run — it updates each tier in
// place by slug instead of erroring on duplicates.
//
// Usage:
//   node seed-subscriptions.js
require('dotenv').config();
const mongoose = require('mongoose');
const Subscription = require('./models/Subscription');

// Feature lists and prices mirror the `subscriptionTiers` arrays in the
// frontend subscription pages. Paid tiers include the 7-day free trial
// offered by OwnerSubscriptionPage.jsx; Free has none since it's never billed.
const SEED_TIERS = [
  {
    tier_name: 'THERAPYPRO: FREE',
    slug: 'free',
    description: 'Core tools to get a solo practice up and running, forever free.',
    price: '0',
    currency: 'PHP',
    billing_cycle: 'monthly',
    trial_period_days: 0,
    features: [
      'Appointment Booking',
      'Online Payments',
      'SOAP Notes / Documentation',
      'Note-taking Tools',
    ],
    is_active: true,
    is_popular: false,
    sort_order: 1,
  },
  {
    tier_name: 'THERAPYPRO: SILVER',
    slug: 'silver',
    description: 'Adds voice-assisted documentation for busier practices.',
    price: '299',
    currency: 'PHP',
    billing_cycle: 'monthly',
    trial_period_days: 7,
    features: [
      'Appointment Booking',
      'Online Payments',
      'SOAP Notes / Documentation',
      'Note-taking Tools',
      'Voice Assisted Speech to Text',
      'Text to Speech',
    ],
    is_active: true,
    is_popular: false,
    sort_order: 2,
  },
  {
    tier_name: 'THERAPYPRO: GOLD',
    slug: 'gold',
    description: 'The full TherapyPro experience, including gamified patient engagement.',
    price: '499',
    currency: 'PHP',
    billing_cycle: 'monthly',
    trial_period_days: 7,
    features: [
      'Appointment Booking',
      'Online Payments',
      'SOAP Notes / Documentation',
      'Note-taking Tools',
      'Voice Assisted Speech to Text',
      'Text to Speech',
      'Gamified Interactive Exercises',
      'Avatar Customization',
      'Priority Goal Setting',
    ],
    is_active: true,
    is_popular: true,
    sort_order: 3,
  },
];

async function main() {
  if (!process.env.MONGO_URI) {
    console.error('MONGO_URI is not set. Create backend/.env (see server.js).');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB.');

  for (const tier of SEED_TIERS) {
    await Subscription.findOneAndUpdate(
      { slug: tier.slug },
      { $set: tier },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    console.log(`Upserted tier -> ${tier.slug} (${tier.tier_name})`);
  }

  await mongoose.disconnect();
  console.log('Done.');
}

main().catch((err) => {
  console.error('Seeder failed:', err);
  process.exit(1);
});
