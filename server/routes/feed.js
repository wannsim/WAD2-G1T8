import express from 'express'
import mongoose from 'mongoose'
import Product from '../models/Product.js'
import Shop from '../models/Shop.js'
import User from '../models/User.js'
import Interaction from '../models/Interaction.js'
import Favourite from '../models/Favourite.js'
import Order from '../models/Order.js'
import SearchHistory from '../models/SearchHistory.js'
import { withImageUrl, imageCounts } from '../utils/images.js'

// Owner: Jessie (FYP)
// GET  /feed/:userId?tab=foryou|following    (userId = "guest" when not logged in)
// POST /feed/interactions   body { user, product, shop, type }   type = view|click|save|impression|order
// POST /feed/search         body { user, term }                   (Browse calls this when a buyer searches)
const router = express.Router()

const NEW_SELLER_DAYS = 30
const FEED_SIZE = 20

// load products the same way as before (no Base64 images, shop details populated)
async function loadProducts() {
  const products = await Product.find({ isAvailable: true })
    .select('-images')
    .populate('shop', 'name nearestMrt location stats createdAt')
  return products.filter((p) => p.shop)
}

// 1. gather the signals for one buyer
async function loadSignals(userId) {
  const signals = {
    preferences: [],
    favCategories: {},      // { 'Baked goods': 3, ... }
    clickedCategories: {},  // from view + click interactions
    followedShopIds: new Set(),
    boughtProductIds: new Set(),
    searchTerms: [],        // most recent first
  }
  if (!mongoose.isValidObjectId(userId)) return signals // guest

  const user = await User.findById(userId)
  signals.preferences = user?.preferences || []

  const favs = await Favourite.find({ user: userId }).populate('product', 'category')
  favs.forEach((f) => {
    const c = f.product?.category
    if (c) signals.favCategories[c] = (signals.favCategories[c] || 0) + 1
  })

  const clicks = await Interaction.find({ user: userId, type: { $in: ['view', 'click'] } }).populate('product', 'category')
  clicks.forEach((i) => {
    const c = i.product?.category
    if (c) signals.clickedCategories[c] = (signals.clickedCategories[c] || 0) + 1
  })

  // follows are stored on the shop (Shop.followers is an array of user ids)
  const followed = await Shop.find({ followers: userId }).select('_id')
  followed.forEach((s) => signals.followedShopIds.add(String(s._id)))

  const orders = await Order.find({ buyer: userId, status: { $in: ['accepted', 'completed'] } }).select('product')
  orders.forEach((o) => signals.boughtProductIds.add(String(o.product)))

  const searches = await SearchHistory.find({ user: userId }).sort({ createdAt: -1 }).limit(20)
  signals.searchTerms = searches.map((s) => s.term)

  return signals
}

// 2. score one product
// This function is called once for EVERY product. It gives that product a score for THIS buyer.
// The feed then sorts all products from highest to lowest score, so a higher score = shown earlier.
function scoreProduct(p, signals) {
  let score = 0
  const reasons = []

  if (signals.preferences.includes(p.category)) {
    score += 3
    reasons.push(`Matches your interest in ${p.category}`)
  }

  const trust = p.shop.stats?.trustScore ?? 50
  score += trust / 50
  if (trust >= 80) reasons.push('Highly rated seller')

  const shopAgeDays = (Date.now() - new Date(p.shop.createdAt)) / 86400000
  if (shopAgeDays <= NEW_SELLER_DAYS) {
    score += 1.5
    reasons.push('New seller - give them a try!')
  }

  // A. FAVOURITES: if the buyer has favourited things in this product's category, give points.
  // scaled points
  const favCount = signals.favCategories[p.category] || 0
  if (favCount > 0){
    score += Math.min(favCount, 3)
    reasons.push('You favourited things in this category.')
  }

  // B. CLICKS: categories the buyer keeps opening should score higher.
  const clicksCount = signals.clickedCategories[p.category] || 0
  if (clicksCount > 0){
    score += Math.min(clicksCount, 6) * 0.25
    reasons.push('You browsed things in this category.')
  }

  // C. SEARCH HISTORY: if a recent search term appears in the product's name or tags, give points.
  const searchText = (p.name + ' ' + (p.tags || []).join(' ')).toLowerCase()
  let matches = 0
  let lastMatch = ''
  for (const term of signals.searchTerms) {
    if (searchText.includes(term)) {
      matches += 1
      lastMatch = term
    }
  }
  if (matches > 0) {
    score += Math.min(matches, 2)
    reasons.push(`You searched for "${lastMatch}"`)
  }

  // D. FOLLOWED SHOPS: products from shops the buyer follows get a boost.
  if(signals.followedShopIds.has(String(p.shop._id))){
    score += 3
    reasons.push(`You are following "${p.shop.name}"`)
  }

  // E. ITEMS BOUGHT
  if (signals.boughtProductIds.has(String(p._id))){
    score += 4
    reasons.push(`You bought this before`)
  }

  // F. SELLER FOLLOWER COUNT
  const followers = p.shop.stats?.followerCount || 0
  if(followers > 0){
    score += Math.min(followers/20, 1)
  }

  return { score, reasons }
}

// stop one shop from filling the whole feed
function diversify(items, maxPerShop = 3) {
  const seen = {}
  return items.filter((i) => {
    const id = String(i.product.shop._id)
    seen[id] = (seen[id] || 0) + 1
    return seen[id] <= maxPerShop
  })
}

// 3. the feed (For You + Following)
router.get('/:userId', async (req, res) => {
  try {
    const tab = req.query.tab || 'foryou'
    const products = await loadProducts()
    const counts = await imageCounts(products.map((p) => p._id)) // for the photo carousel
    const signals = await loadSignals(req.params.userId)

    if (tab === 'following') {
      const items = products
        .filter((p) => signals.followedShopIds.has(String(p.shop._id)))
        .sort((a, b) => b.createdAt - a.createdAt)
        .map((p) => ({
          product: withImageUrl(req, p, counts.get(String(p._id))),
          score: 0,
          reason: `From ${p.shop.name}, a shop you follow`,
        }))
      return res.json(items.slice(0, FEED_SIZE))
    }

    // For You
    const items = products.map((p) => {
      const { score, reasons } = scoreProduct(p, signals)
      if (reasons.length === 0) reasons.push('Something different to try')
      return { product: withImageUrl(req, p, counts.get(String(p._id))), score, reason: reasons.join(' | ') }
    })

    items.sort((a, b) => b.score - a.score)
    res.json(diversify(items).slice(0, FEED_SIZE))
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

router.post('/interactions', async (req, res) => {
  try {
    const interaction = await Interaction.create(req.body)
    res.status(201).json(interaction)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

router.post('/search', async (req, res) => {
  try {
    const { user, term } = req.body
    if (!mongoose.isValidObjectId(user) || !term?.trim()) return res.status(204).end()
    await SearchHistory.create({ user, term })
    res.status(201).json({ ok: true })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

export default router
