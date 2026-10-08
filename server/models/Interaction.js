import mongoose from 'mongoose'

// Owner: Member 4 (FYP) | collection: interactions
// One document per thing a buyer does. The FYP algorithm reads these.
const interactionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    shop: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop' },
    type: { type: String, enum: ['view', 'save', 'impression', 'order'], required: true },
  },
  { timestamps: true }
)

export default mongoose.model('Interaction', interactionSchema)
