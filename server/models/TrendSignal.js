import mongoose from 'mongoose'

// Owner: Cheyenne | collection: trendsignals
// One document per keyword our sellers use (a tag or product name), with how much interest it has
// on YouTube right now. Filled once a day by utils/trends.js from the YouTube Data API (YOUTUBE_API_KEY).
const trendSignalSchema = new mongoose.Schema(
  {
    term: { type: String, required: true, unique: true }, // e.g. "matcha" (lowercase)
    query: { type: String, default: '' },          // what we searched YouTube for (filler words removed)
    recentViews: { type: Number, default: 0 },     // views of matching videos uploaded in the last 7 days
    previousViews: { type: Number, default: 0 },   // views of matching videos uploaded the 7 days before
    recentPerDay: { type: Number, default: 0 },    // the same, as views per day online (fair for young vs old videos)
    previousPerDay: { type: Number, default: 0 },
    recentVideos: { type: Number, default: 0 },    // how many matching videos were uploaded this week
    previousVideos: { type: Number, default: 0 },
    growth: { type: Number, default: 0 },          // e.g. 0.35 = +35% compared with a week ago
    method: { type: String, default: '' },         // 'week-on-week' (from history) or 'per-day estimate' (first week)
    history: [{ _id: false, at: Date, views: Number }], // recentViews saved once a day, last 15 days
    topVideoId: { type: String, default: '' },     // most-watched video this week (youtube.com/watch?v=...)
    topVideoTitle: { type: String, default: '' },
    version: { type: Number, default: 1 },         // which rules made this row (utils/trends.js SOURCE_VERSION)
  },
  { timestamps: true }
)

export default mongoose.model('TrendSignal', trendSignalSchema)
