import mongoose from 'mongoose'

// Owner: Wan Sim  | collection: users
const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: function () { return !this.googleId } },
    googleId: { type: String }, 
    // Google Calendar permission; the token is never sent to the browser.
    googleCalendar: {
      refreshToken: { type: String, select: false },
      email: { type: String, default: '' },
      connectedAt: { type: Date, default: null },
      state: { type: String, default: '', select: false },
      stateExpires: { type: Date, default: null },
      returnTo: { type: String, default: '' },
    },
    role: { type: String, enum: ['buyer', 'seller'], default: 'buyer' },
    preferences: { type: [String], default: [] }, // buyer's favourite categories (used by FYP)
    preferredMrt: { type: String, default: '', trim: true },
    // buyer's default delivery address - optional, fills in the order form when they pick Delivery
    deliveryAddress: { type: String, default: '', trim: true },
    deliveryUnit: { type: String, default: '', trim: true },
    deliveryPostalCode: { type: String, default: '', trim: true },
    // profile picture (chat list, top bar). avatar = Base64, never sent in the user JSON (select: false),
    // served by GET /users/:id/avatar. avatarUpdatedAt = when it last changed (null = no picture)
    avatar: { type: String, select: false },
    avatarUpdatedAt: { type: Date, default: null },
    // "Last seen ..." in chat: updated while the user has the app open (see server.js)
    lastSeenAt: { type: Date, default: null },
  },
  { timestamps: true }
)

export default mongoose.model('User', userSchema)
