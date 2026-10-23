import mongoose from 'mongoose'
import express from 'express'
import Favourite from '../models/Favourite.js'
import Interaction from '../models/Interaction.js'
import Product from '../models/Product.js'
import { withImageUrl, imageCounts } from '../utils/images.js'

// Owner: Tanya (Discovery)
// GET /favourites/:userId   GET /favourites/:userId/ids   POST /favourites  (save / un-save)
const router = express.Router()

router.get('/:userId/ids', async (req, res) => {
  try {
    const favs = await Favourite.find({ user: req.params.userId })
    res.json(favs.map((f) => String(f.product)))
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

router.get('/:userId', async (req, res) => {
  try {
    const favs = await Favourite.find({ user: req.params.userId }).populate({
      path: 'product',
      select: '-images', // photos load separately via imageUrl
      populate: { path: 'shop', select: 'name nearestMrt' },
    })
    const live = favs.filter((f) => f.product) // skip products that were deleted
    const counts = await imageCounts(live.map((f) => f.product._id)) // for the photo carousel
    res.json(live.map((f) => ({ ...f.toObject(), product: withImageUrl(req, f.product, counts.get(String(f.product._id))) })))
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// body: { user, product, saved }
//   saved: true  -> save it      saved: false -> un-save it      (no saved -> toggle, for older callers)
// Saying the wanted state (instead of "toggle") means quick double-clicks can never get out of sync.
// Only ONE database write happens before we answer, so the ♥ feels instant; the FYP "save" signal
// is logged after the answer has been sent.
router.post('/', async (req, res) => {
  try {
    const { user, product } = req.body
    if (!mongoose.isValidObjectId(user) || !mongoose.isValidObjectId(product)) {
      return res.status(400).json({ message: 'Log in to save products' })
    }
    let saved = req.body.saved
    if (typeof saved !== 'boolean') saved = !(await Favourite.exists({ user, product })) // toggle

    if (!saved) {
      await Favourite.deleteOne({ user, product })
      return res.json({ saved: false })
    }
    const result = await Favourite.updateOne({ user, product }, { $setOnInsert: { user, product } }, { upsert: true })
    res.json({ saved: true })

    // newly saved -> tell the FYP (in the background, after answering)
    if (result.upsertedCount === 1) {
      Product.findById(product).select('shop').lean()
        .then((p) => Interaction.create({ user, product, shop: p?.shop, type: 'save' }))
        .catch((err) => console.error('Could not log save:', err.message))
    }
  } catch (err) {
    if (err.code === 11000) return res.json({ saved: true }) // two clicks raced: it is saved either way
    res.status(500).json({ message: err.message })
  }
})

export default router
