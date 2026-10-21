import mongoose from 'mongoose'

// Owner: Cheyenne | collection: notifications
// One document per notification shown under the bell icon in the navbar.
//   sellers: new-order, new-review
//   buyers:  order-update, review-reminder, favourite-unavailable, new-product
const notificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // who receives it
    type: {
      type: String,
      enum: ['new-order', 'new-review', 'order-update', 'review-reminder', 'favourite-unavailable', 'new-product'],
      required: true,
    },
    title: { type: String, required: true },
    message: { type: String, default: '' },
    link: { type: String, default: '' }, // page to open on click ('' = nowhere, e.g. favourite-unavailable)
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' }, // favourite-unavailable: the item to remove
    read: { type: Boolean, default: false },
    done: { type: Boolean, default: false }, // favourite-unavailable: buyer already pressed "Remove"
  },
  { timestamps: true }
)

// speeds up "my newest notifications"
notificationSchema.index({ user: 1, createdAt: -1 })

export default mongoose.model('Notification', notificationSchema)
