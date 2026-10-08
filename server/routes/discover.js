import express from 'express'
import Product from '../models/Product.js'

// Owner: Member 3 (Discovery)
// GET /discover?q=&category=&minPrice=&maxPrice=
const router = express.Router()

// stop users typing regex symbols into the search box
function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

router.get('/', async (req, res) => {
  try {
    const { q, category, minPrice, maxPrice } = req.query
    const filter = { isAvailable: true }

    if (q) {
      const pattern = new RegExp(escapeRegex(q), 'i')
      filter.$or = [{ name: pattern }, { description: pattern }, { tags: pattern }]
    }
    if (category) filter.category = category
    if (minPrice || maxPrice) {
      filter.price = {}
      if (minPrice) filter.price.$gte = Number(minPrice)
      if (maxPrice) filter.price.$lte = Number(maxPrice)
    }

    const products = await Product.find(filter)
      .populate('shop', 'name nearestMrt location stats')
      .sort({ createdAt: -1 })
    res.json(products)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// TODO (Member 3): radius filter  GET /discover/nearby?lat=&lng=&km=
//   hint: load shops, use distanceKm() from client/src/utils/geo.js idea on the server, or filter on the client
// TODO (Member 3): search by shop name / nearest MRT as well

export default router
