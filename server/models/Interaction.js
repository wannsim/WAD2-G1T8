import mongoose from 'mongoose'

// Owner: Jessie (FYP) | collection: interactions
// One document per thing a buyer does. The FYP algorithm reads these.
// NEW: 'click' type. Everything except 'order' is auto-deleted after 30 days (TTL index below).
const interactionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    shop: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop' },
    type: { type: String, enum: ['view', 'click', 'save', 'impression', 'order'], required: true },
  },
  { timestamps: true }
)
interactionSchema.index(
  { createdAt: 1 },
  {
    expireAfterSeconds: 60 * 60 * 24 * 30,
    partialFilterExpression: { type: { $in: ['view', 'click', 'save', 'impression'] } },
  }
)
interactionSchema.index({ user: 1, type: 1 })

export default mongoose.model('Interaction', interactionSchema)
