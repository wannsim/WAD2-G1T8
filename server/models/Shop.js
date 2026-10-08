import mongoose from 'mongoose'

// Owner: Cheyenne (profile fields) + Yu Chen (stats fields) | collection: shops
const shopSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    address: { type: String, default: '' },     // private - never show on the map
    postalCode: { type: String, default: '' },
    nearestMrt: { type: String, default: '' },  // shown to buyers
    location: { lat: Number, lng: Number },     // APPROXIMATE coords (rounded) for privacy-safe map pins
    pickup: { type: Boolean, default: true },
    delivery: { type: Boolean, default: false },

    // Filled in by utils/trust.js (Yu Chen). Read by FYP (Member 4).
    stats: {
      avgRating: { type: Number, default: 0 },
      reviewCount: { type: Number, default: 0 },
      fulfilmentRate: { type: Number, default: 0 },   // 0 - 1
      cancellationRate: { type: Number, default: 0 }, // 0 - 1
      avgResponseMins: { type: Number, default: 0 },
      trustScore: { type: Number, default: 50 },      // 0 - 100
    },
  },
  { timestamps: true } // createdAt is used for the FYP "new seller boost"
)

export default mongoose.model('Shop', shopSchema)
