import mongoose from 'mongoose'

// Owner: Jessie (FYP) | collection: searchhistories
// Every search a logged-in buyer makes. MongoDB deletes each document 30 days after createdAt (TTL index).
const searchHistorySchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    term: { type: String, required: true, trim: true, lowercase: true },
  },
  { timestamps: true }
)
searchHistorySchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 30 })

export default mongoose.model('SearchHistory', searchHistorySchema)
