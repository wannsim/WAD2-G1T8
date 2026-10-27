import mongoose from 'mongoose'

const shopSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  name: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  address: { type: String, default: '' },
  postalCode: { type: String, default: '' },
  nearestMrt: { type: String, default: '' },
  location: { lat: Number, lng: Number },
  pickup: { type: Boolean, default: true },
  delivery: { type: Boolean, default: false },
  // products shown first on the shop page (max 3, see PUT /shops/:id/pin)
  pinnedProducts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],

  categories: { type: [String], default: [] }, 
  experience: { type: String, default: '' },
  certifications: { type: [String], default: [] },
  // photos of certificates (e.g. food hygiene cert). image = Base64, served by GET /shops/:id/certs/:certId/image
  certificationFiles: [{ name: { type: String, trim: true, default: '' }, image: String }],
  followers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  // profile picture on the shop page. avatar = Base64, never sent in the shop JSON (select: false),
  // served by GET /shops/:id/avatar. avatarUpdatedAt = when it last changed (null = no picture)
  avatar: { type: String, select: false },
  avatarUpdatedAt: { type: Date, default: null },

  stats: {
    avgRating: { type: Number, default: 0 },
    reviewCount: { type: Number, default: 0 },
    fulfilmentRate: { type: Number, default: 0 },
    cancellationRate: { type: Number, default: 0 },
    avgResponseMins: { type: Number, default: 0 },
    trustScore: { type: Number, default: 50 },
    followerCount: { type: Number, default: 0 },
  },
}, { timestamps: true })

export default mongoose.model('Shop', shopSchema)