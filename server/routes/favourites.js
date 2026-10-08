import express from 'express'
import Favourite from '../models/Favourite.js'
import Interaction from '../models/Interaction.js'
import Product from '../models/Product.js'

// Owner: Member 3 (Discovery)
// GET /favourites/:userId   GET /favourites/:userId/ids   POST /favourites  (toggles)
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
      populate: { path: 'shop', select: 'name nearestMrt' },
    })
    res.json(favs.filter((f) => f.product)) // skip products that were deleted
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// body: { user, product }  -> saves it, or un-saves it if already saved
router.post('/', async (req, res) => {
  try {
    const { user, product } = req.body
    const existing = await Favourite.findOne({ user, product })
    if (existing) {
      await existing.deleteOne()
      return res.json({ saved: false })
    }
    await Favourite.create({ user, product })
    const p = await Product.findById(product)
    await Interaction.create({ user, product, shop: p?.shop, type: 'save' }) // feeds the FYP
    res.json({ saved: true })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

export default router
