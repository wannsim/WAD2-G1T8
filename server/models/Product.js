import mongoose from 'mongoose'

const productSchema = new mongoose.Schema({
  shop: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true },
  name: { type: String, required: true, trim: true },
  category: { type: String, default: '' },
  description: { type: String, default: '' },
  price: { type: Number, required: true, default: 0 },
  unit: { type: String, default: 'piece' },
  images: [{ type: String }], // Multiple images stored as Base64 strings
  tags: [{ type: String }],
  customisable: { type: Boolean, default: false },
  isAvailable: { type: Boolean, default: true },
  orderSlots: [
    {
      start: { type: Date },
      capacity: { type: Number, default: 10 }
    }
  ]
}, { timestamps: true })

// speeds up "all products of this shop, newest first" (shop pages)
productSchema.index({ shop: 1, createdAt: -1 })

export default mongoose.model('Product', productSchema)