import { fileURLToPath } from 'url'
import mongoose from 'mongoose'
import dotenv from 'dotenv'
import bcrypt from 'bcryptjs'
import User from '../models/User.js'
import Shop from '../models/Shop.js'
import Product from '../models/Product.js'
import Order from '../models/Order.js'
import Review from '../models/Review.js'
import { updateShopStats } from '../utils/trust.js'

// Owner: Cheyenne
// Adds lots of orders to ONE seller's shop, so the Shop orders page, calendar and Sales analytics
// have plenty to show. Does not touch anyone else's data.
//   pnpm bob-orders                      (Bob Baker, bob@test.com)
//   pnpm bob-orders -- bob@mock.test     (any other seller's email)
// It adds:  30 accepted (upcoming), 5 accepted but overdue (pickup time already passed),
//           100 completed over the last 4 months (about 60 with reviews).
// The orders come from 10 extra buyer accounts (@bob-orders.test, password: password123).
// Running it again first removes those buyers and their orders / reviews, then makes them fresh.
dotenv.config({ path: './config.env', quiet: true })

const BUYER_DOMAIN = '@bob-orders.test'
const BUYERS = [
  ['Daniel Lim', 'daniel'], ['Sarah Ng', 'sarah'], ['Wei Ming Koh', 'weiming'], ['Nurul Huda', 'nurul'],
  ['Priya Raman', 'priya'], ['Marcus Teo', 'marcus'], ['Jia Hui Chua', 'jiahui'], ['Ahmad Rizal', 'ahmad'],
  ['Rachel Goh', 'rachel'], ['Kenneth Ong', 'kenneth'],
]

const REVIEWS = [
  [5, 'Delicious as always, will order again!'],
  [5, 'Everyone at the party loved it.'],
  [5, 'Fresh and perfectly packed. Pickup was easy.'],
  [5, 'Best in the neighbourhood, no contest.'],
  [4, 'Very good, slightly too sweet for me.'],
  [4, 'Tasty, pickup was a few minutes late but no big deal.'],
  [5, 'Bob remembered my request from last time. Great service.'],
  [4, 'Good value for the price.'],
  [3, 'Nice but a bit dry this batch.'],
  [5, 'My kids finished the whole box in one day!'],
  [4, ''],
  [5, ''],
]
const REQUESTS = ['', 'Less sweet please', 'Please write "Happy Birthday!"', 'No nuts please', 'Gift wrap if possible', '']

// a date `days` from now (negative = in the past) at hh:mm
function at(days, hour, minute = 30) {
  const t = new Date()
  t.setDate(t.getDate() + days)
  t.setHours(hour, minute, 0, 0)
  return t
}

// builds the order + review documents (no database needed, so it can be checked offline)
// buyers: [{ _id }], shop: { _id, delivery }, products: [{ _id, price, customisable }]
export function buildOrders(buyers, shop, products) {
  const orders = []
  const reviews = [] // { orderIndex, rating, comment }
  const add = (status, createdAt, requestedTime, i) => {
    const p = products[i % products.length]
    const quantity = 1 + (i % 3)
    orders.push({
      buyer: buyers[i % buyers.length]._id, shop: shop._id, product: p._id, quantity,
      customisation: p.customisable ? REQUESTS[i % REQUESTS.length] : '',
      // :30 times on purpose, so these orders never fill up the real order slots (those start on the hour)
      fulfilment: shop.delivery && i % 3 === 0 ? 'delivery' : 'pickup',
      deliveryAddress: shop.delivery && i % 3 === 0 ? `Blk ${200 + i} Bishan Street ${10 + (i % 15)}` : '',
      requestedTime, totalPrice: p.price * quantity, status, createdAt, updatedAt: createdAt,
      // Bob replies within 5 minutes to about 3 hours
      respondedAt: new Date(createdAt.getTime() + (5 + ((i * 37) % 180)) * 60000),
    })
  }

  // 30 accepted, pickup in the next 1 - 21 days
  for (let i = 0; i < 30; i++) add('accepted', at(-(1 + (i % 4)), 9 + (i % 10)), at(1 + Math.floor(i * 0.7), 10 + (i % 8)), i)
  // 5 overdue: accepted, but the pickup time was 1 - 5 days ago
  for (let i = 0; i < 5; i++) add('accepted', at(-(6 + i), 10), at(-(1 + i), 11 + i), 30 + i)
  // 100 completed over the last ~4 months, more of them recently (so the sales chart goes up)
  for (let i = 0; i < 100; i++) {
    const daysAgo = 2 + Math.floor(118 * (i / 100) ** 1.4)
    add('completed', at(-daysAgo - 3, 9 + (i % 9)), at(-daysAgo, 10 + (i % 8)), 35 + i)
    if (i % 5 < 3) reviews.push({ orderIndex: orders.length - 1, ...reviewFor(i), daysAgo })
  }
  return { orders, reviews }
}

function reviewFor(i) {
  const [rating, comment] = REVIEWS[(i * 7) % REVIEWS.length]
  return { rating, comment }
}

async function removeOld() {
  const oldBuyers = await User.find({ email: { $regex: `${BUYER_DOMAIN.replace('.', '\\.')}$` } }).select('_id')
  const ids = oldBuyers.map((b) => b._id)
  const orders = await Order.deleteMany({ buyer: { $in: ids } })
  await Review.deleteMany({ buyer: { $in: ids } })
  await User.deleteMany({ _id: { $in: ids } })
  if (ids.length) console.log(`Removed old data: ${ids.length} buyers, ${orders.deletedCount} orders`)
}

async function run() {
  const email = (process.argv[2] || 'bob@test.com').toLowerCase()
  await mongoose.connect(process.env.DB)

  const seller = await User.findOne({ email })
  if (!seller) throw new Error(`No account with email ${email} - run pnpm seed / pnpm mock first, or pass another email`)
  const shop = await Shop.findOne({ owner: seller._id })
  if (!shop) throw new Error(`${seller.name} has no shop`)
  const products = await Product.find({ shop: shop._id }).select('price customisable')
  if (!products.length) throw new Error(`${shop.name} has no products`)

  await removeOld()
  const password = await bcrypt.hash('password123', 10)
  const buyers = await User.create(BUYERS.map(([name, key]) => ({ name, email: key + BUYER_DOMAIN, password, role: 'buyer' })))

  const { orders, reviews } = buildOrders(buyers, shop, products)
  const saved = await Order.insertMany(orders) // insertMany keeps our createdAt dates
  await Review.insertMany(reviews.map((r) => {
    const o = saved[r.orderIndex]
    const createdAt = at(-r.daysAgo + 1, 20)
    return { order: o._id, buyer: o.buyer, shop: o.shop, product: o.product, rating: r.rating, comment: r.comment, createdAt, updatedAt: createdAt }
  }))
  await updateShopStats(shop._id)

  console.log(`Added to ${shop.name} (${seller.name}): 30 accepted, 5 overdue, 100 completed, ${reviews.length} reviews`)
  console.log(`Log in as ${email} to see them. Buyers: daniel${BUYER_DOMAIN} etc. (password: password123)`)
  await mongoose.disconnect()
}

// only runs with "pnpm bob-orders" (importing this file does nothing)
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch(async (err) => {
    console.error(err.message)
    await mongoose.disconnect()
    process.exit(1)
  })
}
