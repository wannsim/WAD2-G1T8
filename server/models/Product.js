import mongoose from 'mongoose'

// Owner: Cheyenne | collection: products
// Standardised format: every product has the same fields so buyers can compare across shops.
const slotSchema = new mongoose.Schema({
  start: { type: Date, required: true }, // pickup / delivery slot
  capacity: { type: Number, default: 1 },
})

const productSchema = new mongoose.Schema(
  {
    shop: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true },
    name: { type: String, required: true, trim: true },
    category: { type: String, required: true }, // keep in sync with CATEGORIES in client/src/utils/constants.js
    description: { type: String, default: '' },
    price: { type: Number, required: true, min: 0 },
    unit: { type: String, default: 'piece' },   // e.g. piece, box, 6-pack
    imageUrl: { type: String, default: '' },
    tags: { type: [String], default: [] },
    customisable: { type: Boolean, default: false },
    orderSlots: { type: [slotSchema], default: [] },
    isAvailable: { type: Boolean, default: true },
  },
  { timestamps: true }
)

export default mongoose.model('Product', productSchema)
