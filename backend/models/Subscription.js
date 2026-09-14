const mongoose = require('mongoose');

// Matches the `subscriptions` collection $jsonSchema validator in Atlas.
// created_at / updated_at are managed by the timestamps option below.
const subscriptionSchema = new mongoose.Schema(
  {
    tier_name: { type: String, required: true, trim: true },
    slug: { type: String, trim: true, lowercase: true },
    description: { type: String, trim: true },
    price: { type: mongoose.Schema.Types.Decimal128, required: true, min: 0 },
    currency: { type: String, trim: true, default: 'PHP' },
    billing_cycle: {
      type: String,
      required: true,
      enum: ['monthly', 'quarterly', 'annually'],
    },
    trial_period_days: { type: Number, min: 0 },
    features: { type: [String], default: [] },
    max_staff: { type: Number, min: 0 },
    storage_limit_mb: { type: Number, min: 0 },
    is_active: { type: Boolean, required: true, default: true },
    is_popular: { type: Boolean, default: false },
    sort_order: { type: Number },
    discount_percent: { type: mongoose.Schema.Types.Decimal128, min: 0, max: 100 },
  },
  {
    collection: 'subscription',
    versionKey: false,
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);

module.exports = mongoose.model('Subscription', subscriptionSchema);
