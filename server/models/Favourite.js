import mongoose from 'mongoose'

// Owner: Member 3 (Discovery) | collection: favourites
const favouriteSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  },
  { timestamps: true }
)
favouriteSchema.index({ user: 1, product: 1 }, { unique: true }) // can't favourite the same product twice

export default mongoose.model('Favourite', favouriteSchema)
