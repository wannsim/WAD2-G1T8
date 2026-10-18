import express from 'express'
import Product from '../models/Product.js'
import Shop from '../models/Shop.js'
import { withImageUrl } from '../utils/images.js'

// Owner: Tanya (Discovery)
// GET /discover?q=&category=&minPrice=&maxPrice=
const router = express.Router()

// stop users typing regex symbols into the search box
function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

router.get('/', async (req, res) => {
  try {
    const { q, category, maxPrice, shopName } = req.query
    const productFilter = { isAvailable: true }
    const shopFilter = {}

    // Products filter
    if (q) {
      const pattern = new RegExp(escapeRegex(q), 'i')
      productFilter.$or = [{ name: pattern }, { description: pattern }, { tags: pattern }]
    }
    if (category) productFilter.category = category
    if (maxPrice) {
      productFilter.price = {}
      productFilter.price.$lte = Number(maxPrice)
    }

    // Shops filter
    if (q) {
      const pattern = new RegExp(`^${escapeRegex(q)}$`, 'i')
      shopFilter.name = pattern 
    } else {
      shopFilter._id = { $exists: false }
    }

    // return products + shops
    const [products, shops] = await Promise.all([
      Product.find(productFilter)
      .select('-images') // photos load separately via imageUrl
      .populate('shop', 'name nearestMrt location stats')
      .sort({ createdAt: -1 })
      .lean(),

      // leave out the private address and the big certificate photos
      Shop.find(shopFilter).select('-address -postalCode -certificationFiles.image')
    ])
    // skip products whose shop no longer exists (their product page would have no seller)
    res.json({ products: products.filter((p) => p.shop).map((p) => withImageUrl(req, p)), shops })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// TODO (Member 3): radius filter  GET /discover/nearby?lat=&lng=&km=
//   hint: load shops, use distanceKm() from client/src/utils/geo.js idea on the server, or filter on the client
// TODO (Member 3): search by shop name / nearest MRT as well

export default router
