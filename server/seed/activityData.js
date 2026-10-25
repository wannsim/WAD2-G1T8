import mongoose from 'mongoose'
import dotenv from 'dotenv'
import bcrypt from 'bcryptjs'
import User from '../models/User.js'
import Shop from '../models/Shop.js'
import Product from '../models/Product.js'
import Order from '../models/Order.js'
import Interaction from '../models/Interaction.js'
import Favourite from '../models/Favourite.js'
import SearchHistory from '../models/SearchHistory.js'
import { updateShopStats } from '../utils/trust.js'

// Owner: Cheyenne
// TEST DATA FOR THE RECOMMENDATIONS (For you + Trending). Run AFTER the mock data:
//   pnpm mock        (shops + products)
//   pnpm activity    (this file: buyers with clear behaviour, and a "trending story" for this week)
// Like mockData.js it only touches @mock.test accounts, and running it again replaces its own data.
// Everyone's password: password123. At the end it prints what each test account SHOULD see.
dotenv.config({ path: './config.env' })

const DAY = 86400000
const ago = (days, hours = 0) => new Date(Date.now() - days * DAY - hours * 3600000)

// ---------- 5 test buyers, each one tests ONE part of For you (no saved interests, so that signal shows) ----------
const PERSONAS = [
  { key: 'sam', name: 'Sam Searcher', email: 'sam.search@mock.test', tests: 'SEARCH HISTORY' },
  { key: 'cleo', name: 'Cleo Clicker', email: 'cleo.clicks@mock.test', tests: 'CLICKS + SIMILAR KIND' },
  { key: 'fiona', name: 'Fiona Follower', email: 'fiona.follows@mock.test', tests: 'FOLLOWED SHOPS' },
  { key: 'max', name: 'Max Mixed', email: 'max.mixed@mock.test', tests: 'EVERYTHING TOGETHER' },
  { key: 'nina', name: 'Nina Newbie', email: 'nina.new@mock.test', tests: 'BRAND-NEW BUYER (no activity)' },
]
// ---------- 15 other buyers who make things trend ----------
const CROWD = Array.from({ length: 15 }, (_, i) => ({ name: `Crowd Buyer ${i + 1}`, email: `crowd${i + 1}@mock.test` }))
const ALL_EMAILS = [...PERSONAS, ...CROWD].map((u) => u.email)

async function removeOldActivity() {
  const users = await User.find({ email: { $in: ALL_EMAILS } }, '_id')
  const ids = users.map((u) => u._id)
  if (ids.length === 0) return
  const orders = await Order.find({ buyer: { $in: ids } }, 'shop')
  await Promise.all([
    Interaction.deleteMany({ user: { $in: ids } }),
    Favourite.deleteMany({ user: { $in: ids } }),
    SearchHistory.deleteMany({ user: { $in: ids } }),
    Order.deleteMany({ buyer: { $in: ids } }),
    Shop.updateMany({}, { $pull: { followers: { $in: ids } } }),
  ])
  await User.deleteMany({ _id: { $in: ids } })
  for (const shopId of new Set(orders.map((o) => String(o.shop)))) await updateShopStats(shopId)
  console.log(`Removed old activity test data (${ids.length} buyers)`)
}

async function run() {
  await mongoose.connect(process.env.DB)

  // the mock shops / products must exist
  const products = await Product.find({}).populate('shop', 'name owner').lean()
  const byName = Object.fromEntries(products.filter((p) => p.shop).map((p) => [p.name, p]))
  const needed = ['Matcha Cupcakes', 'Classic Cold Brew', 'Lemongrass Ginger Tea', 'Teh Tarik Kit', 'Chicken Biryani',
    'Strawberry Mochi', 'Kueh Lapis', 'Pineapple Tarts', 'Masala Dosa (Frozen Batter)', 'Lavender Soy Candle', 'Crochet Plushie', 'Handmade Greeting Cards']
  const missing = needed.filter((n) => !byName[n])
  if (missing.length) {
    console.log(`Mock products not found (${missing.join(', ')}). Run "pnpm mock" first, then "pnpm activity".`)
    await mongoose.disconnect()
    return
  }
  const shopNamed = async (name) => Shop.findOne({ name })

  await removeOldActivity()

  const password = await bcrypt.hash('password123', 10)
  const people = await User.insertMany([...PERSONAS, ...CROWD].map((u) => ({ name: u.name, email: u.email, password, role: 'buyer', preferences: [] })))
  const user = Object.fromEntries(people.map((u) => [u.email, u]))
  const persona = Object.fromEntries(PERSONAS.map((p) => [p.key, user[p.email]]))
  const crowd = CROWD.map((c) => user[c.email])

  const interactions = []
  const act = (buyer, productName, type, when) => {
    const p = byName[productName]
    interactions.push({ user: buyer._id, product: p._id, shop: p.shop._id, type, createdAt: when, updatedAt: when })
  }
  const favourites = []
  const save = (buyer, productName, when) => {
    favourites.push({ user: buyer._id, product: byName[productName]._id, createdAt: when, updatedAt: when })
    act(buyer, productName, 'save', when)
  }
  const orders = []
  const order = (buyer, productName, when, quantity = 1) => {
    const p = byName[productName]
    orders.push({
      buyer: buyer._id, shop: p.shop._id, product: p._id, quantity, fulfilment: 'pickup',
      requestedTime: new Date(when.getTime() + 4 * 3600000), totalPrice: p.price * quantity,
      status: 'completed', respondedAt: new Date(when.getTime() + 20 * 60000), createdAt: when, updatedAt: when,
    })
    act(buyer, productName, 'order', when)
  }
  const follow = async (buyer, shopName) => {
    const shop = await shopNamed(shopName)
    const updated = await Shop.findByIdAndUpdate(shop._id, { $addToSet: { followers: buyer._id } }, { new: true })
    await Shop.updateOne({ _id: shop._id }, { 'stats.followerCount': updated.followers.length })
  }
  const searches = []
  const search = (buyer, term, when) => searches.push({ user: buyer._id, term, createdAt: when, updatedAt: when })

  // ===== FOR YOU personas =====
  // Sam: searched for matcha (twice) and cupcakes, nothing else
  search(persona.sam, 'matcha cupcakes', ago(0, 2))
  search(persona.sam, 'matcha', ago(1))
  search(persona.sam, 'cupcake', ago(3))

  // Cleo: keeps opening Classic Cold Brew + Lemongrass tea (drinks / "tea" tag) but never buys
  for (let i = 0; i < 4; i++) {
    act(persona.cleo, 'Classic Cold Brew', 'click', ago(i, 1))
    act(persona.cleo, 'Classic Cold Brew', 'view', ago(i, 1))
  }
  act(persona.cleo, 'Lemongrass Ginger Tea', 'click', ago(1))
  act(persona.cleo, 'Lemongrass Ginger Tea', 'view', ago(1))

  // Fiona: follows two shops, nothing else
  await follow(persona.fiona, 'Sweet Spoon Desserts')
  await follow(persona.fiona, 'Woodlands Wok')

  // Max: a bit of everything around crafts
  await follow(persona.max, "Cara's Crafts")
  search(persona.max, 'candle', ago(0, 5))
  act(persona.max, 'Crochet Plushie', 'click', ago(1))
  act(persona.max, 'Crochet Plushie', 'view', ago(1))
  save(persona.max, 'Handmade Greeting Cards', ago(2))
  order(persona.max, 'Lavender Soy Candle', ago(9)) // bought before

  // ===== TRENDING story (this week) =====
  // 1st: Chicken Biryani - 8 different buyers ordered it in the last 2 days
  crowd.slice(0, 8).forEach((b, i) => {
    act(b, 'Chicken Biryani', 'view', ago(i % 2, 3))
    order(b, 'Chicken Biryani', ago(i % 2, 2))
  })
  // 2nd: Strawberry Mochi - saved by 7 buyers yesterday
  crowd.slice(3, 10).forEach((b) => {
    act(b, 'Strawberry Mochi', 'view', ago(1, 2))
    save(b, 'Strawberry Mochi', ago(1))
  })
  // 3rd: Kueh Lapis - 10 buyers looked at it 2 days ago
  crowd.slice(0, 10).forEach((b) => {
    act(b, 'Kueh Lapis', 'click', ago(2))
    act(b, 'Kueh Lapis', 'view', ago(2))
  })
  // TRAP 1: Pineapple Tarts sold a lot 2-3 weeks ago, nothing this week -> should NOT trend
  crowd.forEach((b, i) => order(b, 'Pineapple Tarts', ago(14 + (i % 7))))
  // TRAP 2: one buyer clicks Masala Dosa 150 times today -> capped, should NOT reach the top 3
  for (let i = 0; i < 150; i++) act(crowd[14], 'Masala Dosa (Frozen Batter)', 'click', ago(0, i % 6))

  await Interaction.insertMany(interactions)
  await Favourite.insertMany(favourites)
  await SearchHistory.insertMany(searches)
  await Order.insertMany(orders)
  for (const shopId of new Set(orders.map((o) => String(o.shop)))) await updateShopStats(shopId)

  // real numbers for the reasons (the normal mock data adds a few of its own this week)
  const week = ago(7)
  const countThisWeek = async (name, type) => Interaction.countDocuments({ product: byName[name]._id, type, createdAt: { $gte: week } })
  const lookers = async (name) => (await Interaction.distinct('user', { product: byName[name]._id, createdAt: { $gte: week } })).length
  const biryaniOrders = await countThisWeek('Chicken Biryani', 'order')
  const mochiSaves = await countThisWeek('Strawberry Mochi', 'save')
  const kuehPeople = await lookers('Kueh Lapis')

  console.log(`Activity test data added: ${people.length} buyers, ${interactions.length} interactions, ${orders.length} orders, ` +
    `${favourites.length} favourites, ${searches.length} searches`)
  console.log(`
Log in (password: password123) and open "For you" / "Trending". You should see:

  TRENDING tab (any account, or logged out)
    #1 Chicken Biryani    "Ordered ${biryaniOrders} times this week"
    #2 Strawberry Mochi   "Saved by ${mochiSaves} buyers this week"
    #3 Kueh Lapis         "${kuehPeople} people looked at this this week"
    NOT in the top 3: Pineapple Tarts (popular 2-3 weeks ago, not this week - far down the list)
                      Masala Dosa (one buyer clicked it 150 times - capped, so it stays below the top 3)
    With YOUTUBE_API_KEY set, some cards may say '"Tea" is trending on YouTube (+x% this week)' -
    that part comes from YouTube and changes day to day.

  FOR YOU tab
    sam.search@mock.test     Matcha Cupcakes near the top: "You searched for "matcha cupcakes""
    cleo.clicks@mock.test    Classic Cold Brew: "You looked at this recently";
                             other drinks (Teh Tarik Kit...) high: "Similar to "tea" items you viewed" / "You often browse Drinks"
    fiona.follows@mock.test  Sweet Spoon Desserts + Woodlands Wok products on top: "You are following ..."
                             (4 items - Woodlands Wok's Sambal Kangkong is sold out in the mock data)
    max.mixed@mock.test      Cara's Crafts items on top (follow + "candle" search + plushie clicks + saved cards)
    nina.new@mock.test       no activity yet: this week's trending picks (e.g. Chicken Biryani) near the top,
                             plus highly rated sellers

  Try it live: as nina, search "mochi" on Browse or open a few drinks, go back to For you and press Refresh.
`)
  await mongoose.disconnect()
}

run().catch(async (err) => {
  console.error(err)
  await mongoose.disconnect()
  process.exit(1)
})
