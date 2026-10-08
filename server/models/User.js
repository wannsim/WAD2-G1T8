import mongoose from 'mongoose'

// Owner: Wan Sim  | collection: users
const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true }, // bcrypt hash, never plain text
    role: { type: String, enum: ['buyer', 'seller'], default: 'buyer' },
    preferences: { type: [String], default: [] }, // buyer's favourite categories (used by FYP)
  },
  { timestamps: true }
)

export default mongoose.model('User', userSchema)
