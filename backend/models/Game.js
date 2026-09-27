const mongoose = require('mongoose');

// Matches the `games` collection $jsonSchema validator in Atlas exactly —
// this is the game *catalog* a Super Admin authors in GamesLibraryPage
// (name, therapy area, editor template, levels/content, publishing status),
// not a per-play activity log (see models/GameSession.js for that).
const choiceSchema = new mongoose.Schema(
  {
    label: { type: String },
    image_url: { type: String },
    audio_url: { type: String },
    is_correct: { type: Boolean, required: true },
  },
  { _id: false }
);

const levelItemSchema = new mongoose.Schema(
  {
    label: { type: String, maxlength: 80 },
    text: { type: String, maxlength: 200 },
    image_url: { type: String },
    audio_url: { type: String },
    zone_key: { type: String },
    step_order: { type: Number, min: 1 },
    question: { type: String },
    choices: { type: [choiceSchema], default: undefined },
    syllables: { type: [String], default: undefined },
    sign_video_url: { type: String },
    video_url: { type: String },
    reps: { type: Number, min: 1, max: 20 },
    hold_seconds: { type: Number, min: 0, max: 30 },
  },
  { _id: false }
);

const levelSchema = new mongoose.Schema(
  {
    level_order: { type: Number, required: true, min: 1 },
    level_name: { type: String, required: true },
    prompt_level: { type: String, enum: ['full_model', 'partial', 'none'] },
    items: { type: [levelItemSchema], required: true, default: [] },
  },
  { _id: false }
);

const sortPlaceZoneSchema = new mongoose.Schema(
  {
    zone_key: { type: String, required: true },
    label: { type: String, required: true },
    color: { type: String },
  },
  { _id: false }
);

const typeSettingsSchema = new mongoose.Schema(
  {
    picture_match: {
      grid_size: { type: String, enum: ['2x2', '2x3', '3x4'] },
      card_face: { type: String, enum: ['picture', 'picture_word'] },
    },
    sort_place: {
      snap_help: { type: String, enum: ['gentle', 'strong'] },
      show_target_outlines: { type: Boolean },
      zones: { type: [sortPlaceZoneSchema], default: undefined },
    },
    choose_picture: {
      choices: { type: Number, enum: [2, 3] },
    },
    step_by_step: {
      show_step_numbers: { type: Boolean },
    },
    say_it: {
      acceptance: { type: String, enum: ['very_flexible', 'flexible', 'exact'] },
      sign_support: { type: Boolean },
    },
    move_with_me: {
      reps: { type: Number, enum: [3, 5, 8] },
      hold_seconds: { type: Number, enum: [2, 3, 5] },
    },
  },
  { _id: false }
);

const gameSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 1, maxlength: 80 },
    description: { type: String, maxlength: 500 },
    therapy_type: {
      type: String,
      required: true,
      enum: ['cognitive', 'speech', 'physical', 'occupational'],
    },
    difficulty: { type: String, enum: ['easy', 'medium', 'hard'] },
    age_range: {
      min: { type: Number, min: 0, max: 99 },
      max: { type: Number, min: 0, max: 99 },
    },
    points_per_play: { type: Number, min: 0 },
    unlocks_badge_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Badge', default: null },
    therapist_note: { type: String, maxlength: 1000 },
    game_type: {
      type: String,
      required: true,
      enum: ['picture_match', 'sort_place', 'choose_picture', 'step_by_step', 'say_it', 'move_with_me'],
    },
    type_settings: { type: typeSettingsSchema, default: undefined },
    levels: { type: [levelSchema], default: undefined },
    support: {
      target_size: { type: String, enum: ['large', 'extra_large'] },
      pace: { type: String, enum: ['no_timer', 'relaxed', 'timed'] },
      prompt_level: { type: String, enum: ['full_model', 'partial', 'none'] },
      read_aloud: { type: Boolean },
      picture_cues: { type: Boolean },
      simple_words: { type: Boolean },
      errorless_learning: { type: Boolean },
      fade_prompts: { type: Boolean },
      calm_visuals: { type: Boolean },
      reward_style: { type: String, enum: ['stars', 'confetti', 'calm'] },
      session_minutes: { type: Number, enum: [5, 10, 15] },
    },
    status: {
      type: String,
      required: true,
      enum: ['draft', 'published', 'archived'],
      default: 'draft',
    },
    source_request_id: { type: mongoose.Schema.Types.ObjectId, ref: 'GameRequest', default: null },
    test_played: { type: Boolean, default: false },
    created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    updated_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    published_at: { type: Date, default: null },
  },
  {
    collection: 'games',
    versionKey: false,
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);

gameSchema.index({ status: 1, therapy_type: 1 });

module.exports = mongoose.model('Game', gameSchema);
