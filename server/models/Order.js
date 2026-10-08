import mongoose from 'mongoose'

// Owner: Basile | collection: orders
const orderSchema = new mongoose.Schema(
  {
    buyer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    shop: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true },
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    quantity: { type: Number, min: 1, default: 1 },
    customisation: { type: String, default: '' },
    fulfilment: { type: String, enum: ['pickup', 'delivery'], default: 'pickup' },
    requestedTime: Date,  // time the buyer asked for
    proposedTime: Date,   // seller's counter-proposal
    totalPrice: Number,   // price x quantity, saved at order time
    status: {
      type: String,
      enum: ['pending', 'accepted', 'declined', 'rescheduled', 'completed', 'cancelled'],
      default: 'pending',
    },
    cancelledBy: { type: String, enum: ['buyer', 'seller'] },
    respondedAt: Date, // first seller response - used for average response time (Yu Chen)
  },
  { timestamps: true }
)

export default mongoose.model('Order', orderSchema)
