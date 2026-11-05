import express from 'express'
import Product from '../models/Product.js'
import { requireShopOwner } from '../utils/auth.js'
import { keywordsFor, loadTrendMap } from '../utils/trends.js'

// Owner: Wan Sim
// GET /forecast/make-next/:shopId   only the shop's owner (requireShopOwner checks the login token). READ ONLY.
// What the "What to make next" panel needs that the shop's orders don't carry:
//   categories      { productId: category } for this shop's products (orders only include the product name)
//   trends          [{ category, term, growth }] rising YouTube keywords (utils/trends.js) that appear in the
//                   names / tags of available products, from any shop, with that product's category as saved
//   trendsAvailable false when there is no trend data at all (no YOUTUBE_API_KEY, or not refreshed yet)
// Matching keywords to the seller's categories (ignoring capitals, with toCategory) and the scoring are in
// client/src/utils/makeNext.js, so they can be tested without a server.
const router = express.Router()

router.get('/make-next/:shopId', requireShopOwner('shopId'), async (req, res) => {
  try {
    const own = await Product.find({ shop: req.params.shopId }).select('category').lean()
    const categories = Object.fromEntries(own.map((p) => [String(p._id), p.category || '']))

    const trendMap = await loadTrendMap() // term -> { growth, ... }, filled once a day by utils/trends.js
    const trends = new Map() // "category|term" -> { category, term, growth } (each keyword once per category)
    if (trendMap.size && own.length) {
      const available = await Product.find({ isAvailable: true }).select('name tags category').lean()
      for (const product of available) {
        for (const term of keywordsFor(product)) {
          const signal = trendMap.get(term)
          if (signal && signal.growth > 0) trends.set(`${product.category}|${term}`, { category: product.category, term, growth: signal.growth })
        }
      }
    }
    res.set('Cache-Control', 'no-store')
    res.json({ categories, trends: [...trends.values()], trendsAvailable: trendMap.size > 0 })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

export default router
