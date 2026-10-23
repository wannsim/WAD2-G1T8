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
import { keywordsFor, loadTrendMap } from '../utils/trends.js'

// Owner: Jessie (FYP) + Cheyenne (activity signals, Trending)
// GET  /feed/:userId?tab=foryou|trending|following   (userId = "guest" when not logged in)
// GET  /feed/:userId/scores?ids=a,b,c                 fresh score + "Why recommended?" for cards already shown (after a ♥ change)
// POST /feed/interactions   body { user, product, shop, type }   type = view|click|save|impression|order
// POST /feed/search         body { user, term }                   (Browse calls this when a buyer searches)
const router = express.Router()

const NEW_SELLER_DAYS = 30
const FEED_SIZE = 20
const DAY = 86400000

// how much each thing a buyer does says about their interest
const ACTION_WEIGHT = { view: 1, click: 2, save: 3, order: 4 } // impressions (just scrolled past) count for nothing

// recent actions matter more: worth half after `halfLifeDays`, a quarter after twice that...
const decay = (date, halfLifeDays) => 0.5 ** ((Date.now() - new Date(date).getTime()) / (halfLifeDays * DAY))

// "Banana walnut loaf!" -> ['banana', 'walnut', 'loaf']
const words = (text) => String(text || '').toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2)

// load products the same way as before (no Base64 images, shop details populated)
async function loadProducts() {
  const products = await Product.find({ isAvailable: true })
    .select('-images')
    .populate('shop', 'name nearestMrt location stats createdAt')
  return products.filter((p) => p.shop)
}

// ======================================================================================
// 1. FOR YOU: gather everything one buyer has done
// ======================================================================================
async function loadSignals(userId) {
  const signals = {
    preferences: [],
    favCategories: {},        // { 'Baked goods': 3, ... }
    categoryInterest: {},     // category -> interest from views / clicks / saves / orders (recent counts more)
    tagInterest: {},          // tag -> interest, from the tags of products the buyer looked at ("similar kind")
    productInterest: {},      // product id -> interest in that exact product
    followedShopIds: new Set(),
    boughtProductIds: new Set(),
    searches: [],             // [{ words: ['matcha', 'cake'], term, weight }] newest first
  }
  if (!mongoose.isValidObjectId(userId)) return signals // guest

  const user = await User.findById(userId)
  signals.preferences = user?.preferences || []

  const favs = await Favourite.find({ user: userId }).populate('product', 'category')
  favs.forEach((f) => {
    const c = f.product?.category
    if (c) signals.favCategories[c] = (signals.favCategories[c] || 0) + 1
  })

  // A. ACTIVITY: views, clicks, saves and orders on products (last 30 days, older ones fade out)
  const actions = await Interaction.find({ user: userId, type: { $in: Object.keys(ACTION_WEIGHT) } })
    .select('type product createdAt')
    .populate('product', 'category tags')
    .lean()
  actions.forEach((a) => {
    if (!a.product) return
    const weight = ACTION_WEIGHT[a.type] * decay(a.createdAt, 7)
    const id = String(a.product._id)
    signals.productInterest[id] = (signals.productInterest[id] || 0) + weight
    const c = a.product.category
    if (c) signals.categoryInterest[c] = (signals.categoryInterest[c] || 0) + weight
    ;(a.product.tags || []).forEach((t) => {
      const tag = t.toLowerCase()
      signals.tagInterest[tag] = (signals.tagInterest[tag] || 0) + weight
    })
  })

  // B. FOLLOWED SHOPS (Shop.followers is an array of user ids)
  const followed = await Shop.find({ followers: userId }).select('_id')
  followed.forEach((s) => signals.followedShopIds.add(String(s._id)))

  const orders = await Order.find({ buyer: userId, status: { $in: ['accepted', 'completed'] } }).select('product')
  orders.forEach((o) => signals.boughtProductIds.add(String(o.product)))

  // C. SEARCH HISTORY: newest searches count most
  const searches = await SearchHistory.find({ user: userId }).sort({ createdAt: -1 }).limit(20).lean()
  signals.searches = searches
    .map((s) => ({ term: s.term, words: words(s.term), weight: decay(s.createdAt, 7) }))
    .filter((s) => s.words.length)

  return signals
}

// ======================================================================================
// 2. FOR YOU: score one product for this buyer
// ======================================================================================
// Called once for EVERY product. Higher score = shown earlier. Each reason remembers how many points it
// added, so the card shows the MOST important one ("Why recommended?").
function scoreProduct(p, signals, trending = null) {
  let score = 0
  const reasons = [] // [{ text, points }]
  const add = (points, text) => {
    score += points
    if (text) reasons.push({ text, points })
  }
  const id = String(p._id)
  const tags = (p.tags || []).map((t) => t.toLowerCase())

  if (signals.preferences.includes(p.category)) add(3, `Matches your interest in ${p.category}`)

  const trust = p.shop.stats?.trustScore ?? 50
  add(trust / 50, trust >= 80 ? 'Highly rated seller' : '')

  const shopAgeDays = (Date.now() - new Date(p.shop.createdAt)) / DAY
  if (shopAgeDays <= NEW_SELLER_DAYS) add(1.5, 'New seller - give them a try!')

  // FAVOURITES in this category
  const favCount = signals.favCategories[p.category] || 0
  if (favCount > 0) add(Math.min(favCount, 3), `You favourited things in ${p.category}`)

  // CLICKS / VIEWS of this exact product (they came back to it = still interested)
  const own = signals.productInterest[id] || 0
  if (own > 0 && !signals.boughtProductIds.has(id)) add(Math.min(own, 6) * 0.4, 'You looked at this recently')

  // SIMILAR KIND (1): same category as what they keep opening
  const catInterest = signals.categoryInterest[p.category] || 0
  if (catInterest > 0) add(Math.min(catInterest, 8) * 0.3, `You often browse ${p.category}`)

  // SIMILAR KIND (2): shares tags with products they looked at (e.g. "matcha" cake after a matcha latte)
  let bestTag = ''
  let tagPoints = 0
  tags.forEach((t) => {
    const w = signals.tagInterest[t] || 0
    tagPoints += w
    if (w > (signals.tagInterest[bestTag] || 0)) bestTag = t
  })
  // don't count the product's own views twice
  const similar = Math.max(0, tagPoints - own * tags.length)
  if (similar > 0 && bestTag) add(Math.min(similar, 8) * 0.35, `Similar to "${bestTag}" items you viewed`)

  // SEARCH HISTORY: search words found in the name, tags, category or description
  const text = new Set([...words(p.name), ...tags.flatMap(words), ...words(p.category), ...words(p.description)])
  let searchPoints = 0
  let matchedTerm = ''
  signals.searches.forEach((s) => {
    const hits = s.words.filter((w) => text.has(w)).length
    if (hits === 0) return
    const points = (hits / s.words.length) * s.weight // all words of the search match = full points
    if (points > 0.15 && !matchedTerm) matchedTerm = s.term
    searchPoints += points
  })
  if (searchPoints > 0.15) add(Math.min(searchPoints, 2) * 1.25, `You searched for "${matchedTerm}"`)

  // FOLLOWED SHOPS
  if (signals.followedShopIds.has(String(p.shop._id))) add(3, `You are following "${p.shop.name}"`)

  // ITEMS BOUGHT
  if (signals.boughtProductIds.has(id)) add(4, 'You bought this before')

  // SELLER FOLLOWER COUNT
  const followers = p.shop.stats?.followerCount || 0
  if (followers > 0) add(Math.min(followers / 20, 1))

  // a little of what everyone likes this week (Trending), so new buyers also get good picks
  const t = trending?.get(id)
  if (t && t.score > 0) add(Math.min(t.score / 10, 1.5), t.score >= 10 ? 'Trending this week' : '')

  return { score, reason: topReason(reasons) }
}

// the reason that added the most points (ties: the one found first)
function topReason(reasons) {
  if (reasons.length === 0) return 'Something different to try'
  return reasons.reduce((best, r) => (r.points > best.points ? r : best)).text
}

// ======================================================================================
// 3. TRENDING: what is popular right now (same for every buyer)
// ======================================================================================
// A. ON OUR SITE (last 7 days): orders > saves > clicks > views, newer actions count more
//    (half-life 3 days). One buyer can add at most 8 points to a product, so nobody can push
//    their own favourite to the top by clicking it 100 times.
// B. ONLINE: is this product's keyword (tag / name) getting more Wikipedia page views this week
//    than last week? (utils/trends.js, free Wikimedia API). Only rising keywords add points.
const TREND_WEIGHT = { view: 1, click: 2, save: 4, order: 6 }
const MAX_POINTS_PER_BUYER = 8

async function loadTrending(products) {
  const since = new Date(Date.now() - 7 * DAY)
  const recent = await Interaction.find({ createdAt: { $gte: since }, type: { $in: Object.keys(TREND_WEIGHT) } })
    .select('user product type createdAt')
    .lean()

  // product -> buyer -> points (so we can cap each buyer), and simple counts for the reason text
  const perBuyer = new Map()
  const counts = new Map()
  recent.forEach((i) => {
    const pid = String(i.product)
    const byBuyer = perBuyer.get(pid) || new Map()
    const uid = String(i.user)
    byBuyer.set(uid, (byBuyer.get(uid) || 0) + TREND_WEIGHT[i.type] * decay(i.createdAt, 3))
    perBuyer.set(pid, byBuyer)
    const c = counts.get(pid) || { view: 0, click: 0, save: 0, order: 0, buyers: new Set() }
    c[i.type]++
    c.buyers.add(uid)
    counts.set(pid, c)
  })

  const trendMap = await loadTrendMap()
  const result = new Map() // product id -> { score, reason, onSite, online }
  products.forEach((p) => {
    const pid = String(p._id)
    let onSite = 0
    ;(perBuyer.get(pid) || new Map()).forEach((points) => (onSite += Math.min(points, MAX_POINTS_PER_BUYER)))

    // best rising keyword for this product
    let online = null
    keywordsFor(p).forEach((term) => {
      const s = trendMap.get(term)
      if (s && s.growth > 0.05 && (!online || s.growth > online.growth)) online = s
    })
    // +5% -> 0.25 pts, +50% -> 2.5 pts, capped at +100% -> 5 pts. Big articles (lots of readers) count a bit more.
    const onlinePoints = online ? Math.min(online.growth, 1) * 5 * (online.recentViews >= 1000 ? 1.2 : 1) : 0

    const c = counts.get(pid)
    let reason = ''
    if (c && c.order >= 2) reason = `Ordered ${c.order} times this week`
    else if (c && c.save >= 2) reason = `Saved by ${c.save} buyers this week`
    else if (c && c.buyers.size >= 2) reason = `${c.buyers.size} people looked at this this week`
    if (onlinePoints > onSite && online) reason = `"${online.article}" is trending online (+${Math.round(online.growth * 100)}% this week)`
    if (!reason && c) reason = 'Getting attention this week'

    result.set(pid, { score: onSite + onlinePoints, reason, onSite, online: online ? { article: online.article, growth: online.growth } : null })
  })
  return result
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

// ======================================================================================
// 4. the feed (For you / Trending / Following)
// ======================================================================================
router.get('/:userId', async (req, res) => {
  try {
    const tab = req.query.tab || 'foryou'
    const products = await loadProducts()
    const counts = await imageCounts(products.map((p) => p._id)) // for the photo carousel
    const toCard = (p) => withImageUrl(req, p, counts.get(String(p._id)))

    if (tab === 'following') {
      const signals = await loadSignals(req.params.userId)
      const items = products
        .filter((p) => signals.followedShopIds.has(String(p.shop._id)))
        .sort((a, b) => b.createdAt - a.createdAt)
        .map((p) => ({ product: toCard(p), score: 0, reason: `From ${p.shop.name}, a shop you follow` }))
      return res.json(items.slice(0, FEED_SIZE))
    }

    const trending = await loadTrending(products)

    if (tab === 'trending') {
      const items = products
        .map((p) => {
          const t = trending.get(String(p._id))
          return { product: toCard(p), score: t.score, reason: t.reason || 'Popular with buyers', trend: { onSite: t.onSite, online: t.online } }
        })
        // most trending first; ties (no activity) -> better-rated shop first
        .sort((a, b) => b.score - a.score || (b.product.shop.stats?.trustScore || 0) - (a.product.shop.stats?.trustScore || 0))
      return res.json(diversify(items).slice(0, FEED_SIZE))
    }

    // For You
    const signals = await loadSignals(req.params.userId)
    const items = products.map((p) => {
      const { score, reason } = scoreProduct(p, signals, trending)
      return { product: toCard(p), score, reason }
    })
    items.sort((a, b) => b.score - a.score)
    res.json(diversify(items).slice(0, FEED_SIZE))
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// fresh scores + reasons for the cards already on screen, e.g. after the buyer (un-)favourites something.
// The page notes the new scores but keeps its order; the ranking only changes when the feed loads again.
// -> { productId: { score, reason } }
router.get('/:userId/scores', async (req, res) => {
  try {
    const ids = String(req.query.ids || '').split(',').filter((id) => mongoose.isValidObjectId(id))
    if (ids.length === 0) return res.json({})
    const products = (await Product.find({ _id: { $in: ids } })
      .select('-images')
      .populate('shop', 'name nearestMrt location stats createdAt')).filter((p) => p.shop)
    const [signals, trending] = await Promise.all([loadSignals(req.params.userId), loadTrending(products)])
    const result = {}
    products.forEach((p) => (result[String(p._id)] = scoreProduct(p, signals, trending)))
    res.json(result)
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
