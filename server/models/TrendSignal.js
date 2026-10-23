import mongoose from 'mongoose'

// Owner: Cheyenne | collection: trendsignals
// One document per keyword our sellers use (a tag or product name), with how much interest it has
// online right now. Filled by utils/trends.js from the free Wikimedia Pageviews API (no API key).
const trendSignalSchema = new mongoose.Schema(
  {
    term: { type: String, required: true, unique: true }, // e.g. "matcha" (lowercase)
    article: { type: String, default: '' },  // Wikipedia article it maps to, e.g. "Matcha" ('' = no good match)
    recentViews: { type: Number, default: 0 },   // page views in the last 7 days
    previousViews: { type: Number, default: 0 }, // page views in the 7 days before that
    growth: { type: Number, default: 0 },        // (recent - previous) / previous, e.g. 0.35 = +35%
  },
  { timestamps: true }
)

export default mongoose.model('TrendSignal', trendSignalSchema)
