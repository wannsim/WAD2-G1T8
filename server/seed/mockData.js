import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import mongoose from 'mongoose'
import dotenv from 'dotenv'
import bcrypt from 'bcryptjs'
import User from '../models/User.js'
import Shop from '../models/Shop.js'
import Product from '../models/Product.js'
import Order from '../models/Order.js'
import Review from '../models/Review.js'
import Interaction from '../models/Interaction.js'
import Favourite from '../models/Favourite.js'
import SearchHistory from '../models/SearchHistory.js'
import Conversation from '../models/Conversation.js'
import Message from '../models/Message.js'
import { updateShopStats } from '../utils/trust.js'

// Adds a bigger set of test data WITHOUT touching anyone else's data.
//   pnpm mock
// Every mock account has an @mock.test email. Running this again first removes only those
// accounts (and their shops, products, orders, ...) and then creates them fresh.
// All mock accounts use the password: password123
dotenv.config({ path: './config.env' })

const MOCK_DOMAIN = '@mock.test'

const daysFromNow = (d, hour = 14) => {
  const t = new Date()
  t.setDate(t.getDate() + d)
  t.setHours(hour, 0, 0, 0)
  return t
}
const pick = (arr, i) => arr[i % arr.length]

// ---------- product photos, stored like uploaded photos (Base64) ----------
// Real-looking photos live in seed/images/<product-name-slug>-<n>.jpg (AI-generated to match each product).
// If one is missing, a simple coloured SVG card is used instead.
const IMAGE_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'images')
const slugify = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

function productPhoto(name, category, emoji, variant) {
  const file = path.join(IMAGE_DIR, `${slugify(name)}-${variant}.jpg`)
  if (fs.existsSync(file)) return `data:image/jpeg;base64,${fs.readFileSync(file).toString('base64')}`
  return svgPhoto(name, category, emoji, variant)
}

const CATEGORY_STYLE = {
  'Baked goods': ['#f59e0b', '#b45309'],
  Meals: ['#ef4444', '#991b1b'],
  'Snacks & desserts': ['#ec4899', '#9d174d'],
  Drinks: ['#06b6d4', '#155e75'],
  'Handmade crafts': ['#8b5cf6', '#5b21b6'],
  Others: ['#10b981', '#065f46'],
}
const escapeXml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/'/g, '&apos;').replace(/"/g, '&quot;')

function svgPhoto(name, category, emoji, variant) {
  const [light, dark] = CATEGORY_STYLE[category] || CATEGORY_STYLE.Others
  const angle = [0, 45, 90][variant % 3]
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600">
  <defs><linearGradient id="g" gradientTransform="rotate(${angle} .5 .5)"><stop offset="0" stop-color="${light}"/><stop offset="1" stop-color="${dark}"/></linearGradient></defs>
  <rect width="600" height="600" fill="url(#g)"/>
  <text x="300" y="${variant === 0 ? 320 : 300}" font-size="${variant === 0 ? 220 : 180}" text-anchor="middle" dominant-baseline="middle">${emoji}</text>
  <text x="300" y="530" font-family="Helvetica, Arial, sans-serif" font-size="38" font-weight="700" fill="white" text-anchor="middle">${escapeXml(name)}</text>
  ${variant > 0 ? `<text x="300" y="70" font-family="Helvetica, Arial, sans-serif" font-size="26" fill="white" opacity="0.85" text-anchor="middle">photo ${variant + 1}</text>` : ''}
</svg>`
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`
}

// ---------- sellers + their shops ----------
const SELLERS = [
  { name: 'Bob Tan', email: 'bob', shop: "Bob's Bakes", mrt: 'Bishan', lat: 1.351, lng: 103.8485, postal: '570123',
    categories: ['Baked goods'], delivery: true, desc: 'Small-batch cookies, cakes and breads from my HDB kitchen.' },
  { name: 'Cara Lim', email: 'cara', shop: "Cara's Crafts", mrt: 'Tampines', lat: 1.354, lng: 103.9453, postal: '520456',
    categories: ['Handmade crafts'], delivery: false, desc: 'Handmade candles, keychains and crochet gifts.' },
  { name: 'Dinesh Kumar', email: 'dinesh', shop: 'Amma\'s Kitchen', mrt: 'Jurong East', lat: 1.3331, lng: 103.7422, postal: '600789',
    categories: ['Meals'], delivery: true, desc: 'Home-cooked South Indian meals, just like my mother makes.' },
  { name: 'Ella Ng', email: 'ella', shop: 'Sweet Spoon Desserts', mrt: 'Punggol', lat: 1.4052, lng: 103.9024, postal: '820111',
    categories: ['Snacks & desserts'], delivery: true, desc: 'Mochi, puddings and kueh made fresh every weekend.' },
  { name: 'Farid Rahman', email: 'farid', shop: 'Brew Bros Cold Brew', mrt: 'Toa Payoh', lat: 1.3327, lng: 103.8474, postal: '310222',
    categories: ['Drinks'], delivery: true, desc: 'Cold brew coffee and homemade teas, bottled to order.' },
  { name: 'Grace Wong', email: 'grace', shop: "Grace's Nonya Kueh", mrt: 'Bedok', lat: 1.324, lng: 103.93, postal: '460333',
    categories: ['Snacks & desserts', 'Baked goods'], delivery: false, desc: 'Traditional Peranakan kueh from family recipes.' },
  { name: 'Hari Singh', email: 'hari', shop: 'Woodlands Wok', mrt: 'Woodlands', lat: 1.437, lng: 103.7865, postal: '730444',
    categories: ['Meals'], delivery: false, desc: 'Zi char style dishes cooked fresh for pickup. Brand new shop!' },
  { name: 'Ivy Chua', email: 'ivy', shop: 'Ivy Prints & Co', mrt: 'Clementi', lat: 1.3151, lng: 103.7652, postal: '120555',
    categories: ['Handmade crafts', 'Others'], delivery: true, desc: 'Custom stickers, prints and personalised cards.' },
]

// ---------- products (by seller email) ----------
// [name, category, price, unit, emoji, description, tags, customisable, photoCount]
const PRODUCTS = {
  bob: [
    ['Chocolate Chip Cookies', 'Baked goods', 12, 'box of 12', '🍪', 'Chewy cookies with Belgian chocolate, baked to order.', ['cookies', 'chocolate', 'snacks'], false, 3],
    ['Custom Birthday Cake', 'Baked goods', 55, '6-inch cake', '🎂', 'Tell me your flavour, colours and message. Order 3 days ahead.', ['cake', 'birthday', 'party'], true, 2],
    ['Banana Walnut Loaf', 'Baked goods', 15, 'loaf', '🍞', 'Moist banana bread loaded with walnuts.', ['bread', 'banana'], false, 1],
    ['Matcha Cupcakes', 'Baked goods', 18, 'box of 6', '🧁', 'Uji matcha sponge with white chocolate frosting.', ['cupcake', 'matcha'], true, 2],
  ],
  cara: [
    ['Lavender Soy Candle', 'Handmade crafts', 18, 'piece', '🕯️', 'Hand-poured soy wax, 40 hours burn time.', ['candle', 'gift', 'home'], true, 2],
    ['Beaded Keychain', 'Handmade crafts', 6, 'piece', '🔑', 'Pick your colours and initials.', ['keychain', 'gift'], true, 1],
    ['Crochet Plushie', 'Handmade crafts', 25, 'piece', '🧸', 'Soft crochet animals - bear, bunny or frog.', ['crochet', 'toy', 'gift'], true, 3],
  ],
  dinesh: [
    ['Chicken Biryani', 'Meals', 9.5, 'portion', '🍛', 'Fragrant basmati rice with slow-cooked chicken and raita.', ['biryani', 'rice', 'spicy'], false, 2],
    ['Vegetarian Thali Set', 'Meals', 11, 'set', '🥘', 'Three curries, rice, papadum and dessert.', ['vegetarian', 'curry'], false, 1],
    ['Masala Dosa (Frozen Batter)', 'Meals', 8, '1kg tub', '🥞', 'Fermented dosa batter, ready to cook at home.', ['dosa', 'breakfast'], false, 1],
  ],
  ella: [
    ['Strawberry Mochi', 'Snacks & desserts', 14, 'box of 6', '🍡', 'Soft mochi wrapped around fresh strawberries and red bean.', ['mochi', 'japanese', 'dessert'], false, 2],
    ['Mango Sago Pudding', 'Snacks & desserts', 10, 'set of 4', '🥭', 'Creamy mango pudding with sago pearls.', ['pudding', 'mango', 'dessert'], false, 1],
    ['Brown Sugar Pudding Jars', 'Snacks & desserts', 12, 'set of 3', '🍮', 'Silky caramel custard in reusable jars.', ['pudding', 'dessert'], true, 2],
  ],
  farid: [
    ['Classic Cold Brew', 'Drinks', 7, '500ml bottle', '☕', '18-hour steeped single-origin coffee. Lightly sweetened on request.', ['coffee', 'cold brew'], true, 2],
    ['Lemongrass Ginger Tea', 'Drinks', 5, '500ml bottle', '🍵', 'Caffeine-free, made with fresh lemongrass and ginger.', ['tea', 'healthy'], false, 1],
    ['Teh Tarik Kit', 'Drinks', 16, 'kit (10 cups)', '🥤', 'Everything you need to pull teh tarik at home.', ['tea', 'local'], false, 1],
  ],
  grace: [
    ['Kueh Lapis', 'Snacks & desserts', 20, 'tray', '🍰', 'Nine colourful layers, steamed one by one.', ['kueh', 'peranakan', 'dessert'], false, 2],
    ['Pineapple Tarts', 'Baked goods', 28, 'tub of 30', '🍍', 'Melt-in-your-mouth pastry with homemade pineapple jam.', ['tarts', 'cny', 'festive'], false, 3],
    ['Ondeh Ondeh', 'Snacks & desserts', 9, 'box of 10', '🟢', 'Pandan glutinous rice balls with gula melaka.', ['kueh', 'pandan'], false, 1],
  ],
  hari: [
    ['Cereal Prawns', 'Meals', 22, 'plate', '🍤', 'Crispy prawns tossed in buttery cereal and curry leaves.', ['seafood', 'zi char'], false, 1],
    ['Sambal Kangkong', 'Meals', 8, 'plate', '🥬', 'Wok-fried with homemade sambal belacan.', ['vegetables', 'spicy', 'zi char'], false, 1],
  ],
  ivy: [
    ['Custom Name Stickers', 'Handmade crafts', 8, 'sheet of 40', '🏷️', 'Waterproof name labels for bottles and stationery.', ['stickers', 'school'], true, 2],
    ['Illustrated Pet Portrait', 'Others', 35, 'A5 print', '🐶', 'Send me a photo and I will draw your pet.', ['art', 'pet', 'gift'], true, 2],
    ['Handmade Greeting Cards', 'Handmade crafts', 5, 'card', '💌', 'Pressed-flower cards for any occasion.', ['cards', 'gift'], true, 1],
  ],
}

// ---------- buyers ----------
const BUYERS = [
  { name: 'Alice Lee', email: 'alice', preferences: ['Baked goods', 'Snacks & desserts'] },
  { name: 'Ben Ong', email: 'ben', preferences: ['Meals', 'Drinks'] },
  { name: 'Chloe Teo', email: 'chloe', preferences: ['Handmade crafts'] },
  { name: 'Daniel Yeo', email: 'daniel', preferences: [] }, // new user - tests the FYP with no preferences
]

async function removeOldMockData() {
  const users = await User.find({ email: { $regex: `${MOCK_DOMAIN.replace('.', '\\.')}$` } }, '_id')
  const userIds = users.map((u) => u._id)
  if (userIds.length === 0) return
  const shops = await Shop.find({ owner: { $in: userIds } }, '_id')
  const shopIds = shops.map((s) => s._id)
  const products = await Product.find({ shop: { $in: shopIds } }, '_id')
  const productIds = products.map((p) => p._id)
  const conversations = await Conversation.find({ $or: [{ buyer: { $in: userIds } }, { shop: { $in: shopIds } }] }, '_id')

  await Promise.all([
    Message.deleteMany({ conversation: { $in: conversations.map((c) => c._id) } }),
    Conversation.deleteMany({ _id: { $in: conversations.map((c) => c._id) } }),
    Review.deleteMany({ $or: [{ buyer: { $in: userIds } }, { shop: { $in: shopIds } }] }),
    Order.deleteMany({ $or: [{ buyer: { $in: userIds } }, { shop: { $in: shopIds } }] }),
    Favourite.deleteMany({ $or: [{ user: { $in: userIds } }, { product: { $in: productIds } }] }),
    Interaction.deleteMany({ $or: [{ user: { $in: userIds } }, { product: { $in: productIds } }] }),
    SearchHistory.deleteMany({ user: { $in: userIds } }),
    Product.deleteMany({ _id: { $in: productIds } }),
    Shop.deleteMany({ _id: { $in: shopIds } }),
    // real users may have followed a mock shop - leave their accounts, just drop the follow
    Shop.updateMany({}, { $pull: { followers: { $in: userIds } } }),
  ])
  await User.deleteMany({ _id: { $in: userIds } })
  console.log(`Removed old mock data (${userIds.length} users, ${shopIds.length} shops, ${productIds.length} products)`)
}

async function run() {
  await mongoose.connect(process.env.DB)
  await removeOldMockData()

  const password = await bcrypt.hash('password123', 10)

  // users
  const sellers = await User.create(SELLERS.map((s) => ({ name: s.name, email: s.email + MOCK_DOMAIN, password, role: 'seller' })))
  const buyers = await User.create(BUYERS.map((b) => ({ name: b.name, email: b.email + MOCK_DOMAIN, password, role: 'buyer', preferences: b.preferences })))
  const buyer = Object.fromEntries(BUYERS.map((b, i) => [b.email, buyers[i]]))

  // shops
  const shops = await Shop.create(SELLERS.map((s, i) => ({
    owner: sellers[i]._id, name: s.shop, description: s.desc,
    address: `Blk ${100 + i * 37} ${s.mrt} Street ${10 + i}`, postalCode: s.postal, nearestMrt: s.mrt,
    location: { lat: s.lat, lng: s.lng }, pickup: true, delivery: s.delivery, categories: s.categories,
    experience: `${i + 1} year${i ? 's' : ''} selling from home`,
    certifications: i % 2 === 0 ? ['Basic Food Hygiene Course'] : [],
  })))
  const shopBy = Object.fromEntries(SELLERS.map((s, i) => [s.email, shops[i]]))

  // products
  const productDocs = []
  for (const [sellerKey, list] of Object.entries(PRODUCTS)) {
    list.forEach(([name, category, price, unit, emoji, description, tags, customisable, photos], i) => {
      productDocs.push({
        shop: shopBy[sellerKey]._id, name, category, price, unit, description, tags, customisable,
        isAvailable: !(sellerKey === 'hari' && i === 1), // one sold-out item to test availability
        images: Array.from({ length: photos }, (_, v) => productPhoto(name, category, emoji, v)),
        orderSlots: [
          { start: daysFromNow(2 + (i % 3), 11), capacity: 5 },
          { start: daysFromNow(4 + (i % 3), 15), capacity: 5 },
          { start: daysFromNow(7, 10), capacity: 3 },
        ],
      })
    })
  }
  const products = await Product.create(productDocs)
  const product = Object.fromEntries(products.map((p) => [p.name, p]))
  const shopOf = (p) => shops.find((s) => s._id.equals(p.shop))

  // pin a couple of products on some shops
  await Shop.updateOne({ _id: shopBy.bob._id }, { pinnedProducts: [product['Custom Birthday Cake']._id, product['Chocolate Chip Cookies']._id] })
  await Shop.updateOne({ _id: shopBy.grace._id }, { pinnedProducts: [product['Pineapple Tarts']._id] })

  // orders: past completed ones (with reviews) + current ones in every status
  // [buyer, product, status, daysAgo, rating?, comment?, extra?]
  const ORDERS = [
    ['alice', 'Chocolate Chip Cookies', 'completed', 20, 5, 'Best cookies I have had in Singapore!'],
    ['alice', 'Custom Birthday Cake', 'completed', 14, 5, 'Bob nailed the design, my daughter loved it.'],
    ['ben', 'Chocolate Chip Cookies', 'completed', 10, 4, 'Very good, a little sweet for me.'],
    ['chloe', 'Matcha Cupcakes', 'completed', 8, 5, 'Strong matcha flavour, not too sweet.'],
    ['ben', 'Chicken Biryani', 'completed', 18, 5, 'Generous portion and super fragrant.'],
    ['ben', 'Vegetarian Thali Set', 'completed', 9, 4, 'Great value.'],
    ['alice', 'Chicken Biryani', 'completed', 6, 3, 'Tasty but arrived a bit late.'],
    ['alice', 'Strawberry Mochi', 'completed', 12, 5, 'So soft! Will order again.'],
    ['chloe', 'Mango Sago Pudding', 'completed', 7, 4, 'Refreshing.'],
    ['ben', 'Classic Cold Brew', 'completed', 15, 5, 'Smooth and not bitter at all.'],
    ['ben', 'Classic Cold Brew', 'completed', 5, 4, ''],
    ['alice', 'Pineapple Tarts', 'completed', 25, 5, 'Tastes like my grandma\'s.'],
    ['chloe', 'Kueh Lapis', 'completed', 11, 2, 'A bit dry this time.'],
    ['chloe', 'Lavender Soy Candle', 'completed', 16, 5, 'Smells amazing, lovely packaging.'],
    ['alice', 'Crochet Plushie', 'completed', 13, 4, 'Cute frog, took a while to make.'],
    ['chloe', 'Illustrated Pet Portrait', 'completed', 19, 5, 'Captured my cat perfectly!'],
    ['ben', 'Kueh Lapis', 'completed', 4], // completed but not reviewed yet -> can test writing a review
    ['alice', 'Banana Walnut Loaf', 'pending', 0],
    ['ben', 'Cereal Prawns', 'pending', 0],
    ['chloe', 'Custom Name Stickers', 'accepted', 1],
    ['alice', 'Brown Sugar Pudding Jars', 'rescheduled', 1],
    ['ben', 'Lemongrass Ginger Tea', 'declined', 3],
    ['chloe', 'Ondeh Ondeh', 'cancelled', 4, null, null, { cancelledBy: 'buyer' }],
    ['alice', 'Teh Tarik Kit', 'cancelled', 6, null, null, { cancelledBy: 'seller' }],
  ]

  const orders = []
  for (const [buyerKey, productName, status, daysAgo, , , extra] of ORDERS) {
    const p = product[productName]
    const createdAt = daysFromNow(-daysAgo, 9)
    const quantity = 1 + (orders.length % 3)
    orders.push({
      buyer: buyer[buyerKey]._id, shop: p.shop, product: p._id, quantity,
      customisation: p.customisable ? 'Please write "Happy Birthday!" if possible' : '',
      fulfilment: shopOf(p).delivery && orders.length % 2 ? 'delivery' : 'pickup',
      requestedTime: daysFromNow(-daysAgo + 3, 15),
      proposedTime: status === 'rescheduled' ? daysFromNow(4, 17) : undefined,
      totalPrice: p.price * quantity, status, createdAt, updatedAt: createdAt,
      // sellers reply within 10 - 240 minutes; pending orders have no reply yet
      respondedAt: status === 'pending' ? undefined : new Date(createdAt.getTime() + (10 + (orders.length * 37) % 230) * 60000),
      ...extra,
    })
  }
  const savedOrders = await Order.insertMany(orders) // insertMany keeps our createdAt dates

  const reviews = []
  ORDERS.forEach(([, productName, , daysAgo, rating, comment], i) => {
    if (!rating) return
    const o = savedOrders[i]
    reviews.push({ order: o._id, buyer: o.buyer, shop: o.shop, product: product[productName]._id, rating, comment,
      createdAt: daysFromNow(-daysAgo + 4, 20) })
  })
  await Review.insertMany(reviews)

  // follows
  const FOLLOWS = { alice: ['bob', 'ella', 'grace'], ben: ['dinesh', 'farid'], chloe: ['cara', 'ivy', 'bob'] }
  for (const [buyerKey, sellerKeys] of Object.entries(FOLLOWS)) {
    for (const s of sellerKeys) await Shop.updateOne({ _id: shopBy[s]._id }, { $addToSet: { followers: buyer[buyerKey]._id } })
  }
  for (const s of shops) {
    const fresh = await Shop.findById(s._id, 'followers')
    await Shop.updateOne({ _id: s._id }, { 'stats.followerCount': fresh.followers.length })
  }

  // favourites (+ the matching 'save' interaction, like the real ♥ button does)
  const FAVS = {
    alice: ['Matcha Cupcakes', 'Strawberry Mochi', 'Kueh Lapis', 'Pineapple Tarts', 'Brown Sugar Pudding Jars'],
    ben: ['Chicken Biryani', 'Classic Cold Brew', 'Cereal Prawns'],
    chloe: ['Crochet Plushie', 'Lavender Soy Candle', 'Illustrated Pet Portrait', 'Matcha Cupcakes'],
  }
  const favDocs = []
  const interactions = []
  for (const [buyerKey, names] of Object.entries(FAVS)) {
    for (const n of names) {
      favDocs.push({ user: buyer[buyerKey]._id, product: product[n]._id })
      interactions.push({ user: buyer[buyerKey]._id, product: product[n]._id, shop: product[n].shop, type: 'save' })
    }
  }
  await Favourite.insertMany(favDocs)

  // browsing history for the FYP: views / clicks / impressions over the last 2 weeks
  const BROWSING = {
    alice: ['Ondeh Ondeh', 'Mango Sago Pudding', 'Banana Walnut Loaf', 'Kueh Lapis', 'Chocolate Chip Cookies'],
    ben: ['Sambal Kangkong', 'Teh Tarik Kit', 'Masala Dosa (Frozen Batter)', 'Lemongrass Ginger Tea'],
    chloe: ['Handmade Greeting Cards', 'Beaded Keychain', 'Custom Name Stickers', 'Strawberry Mochi'],
  }
  for (const [buyerKey, names] of Object.entries(BROWSING)) {
    names.forEach((n, i) => {
      const base = { user: buyer[buyerKey]._id, product: product[n]._id, shop: product[n].shop }
      const createdAt = daysFromNow(-(i * 2 + 1), 20)
      interactions.push({ ...base, type: 'impression', createdAt }, { ...base, type: 'click', createdAt }, { ...base, type: 'view', createdAt })
      if (i % 2 === 0) interactions.push({ ...base, type: 'view', createdAt: daysFromNow(-i, 21) })
    })
  }
  savedOrders.forEach((o) => interactions.push({ user: o.buyer, product: o.product, shop: o.shop, type: 'order', createdAt: o.createdAt }))
  await Interaction.insertMany(interactions)

  // search history
  const SEARCHES = { alice: ['cake', 'mochi', 'kueh'], ben: ['biryani', 'coffee', 'spicy'], chloe: ['candle', 'gift', 'crochet'] }
  await SearchHistory.insertMany(Object.entries(SEARCHES).flatMap(([b, terms]) =>
    terms.map((term, i) => ({ user: buyer[b]._id, term, createdAt: daysFromNow(-i, 19) }))))

  // chats
  const CHATS = [
    ['alice', 'bob', [['buyer', 'Hi! Can you do a unicorn design for the birthday cake?'], ['seller', 'Yes of course! Any colour preference?'], ['buyer', 'Pink and purple please 😊']]],
    ['ben', 'dinesh', [['buyer', 'Is the biryani very spicy?'], ['seller', 'Medium spicy. I can make it mild if you like.']]],
    ['chloe', 'ivy', [['buyer', 'Can I get the stickers in pastel colours?'], ['seller', 'Sure, I will send you some samples here first.'], ['seller', 'How about these?']]],
  ]
  for (const [buyerKey, sellerKey, lines] of CHATS) {
    const sellerUser = sellers[SELLERS.findIndex((s) => s.email === sellerKey)]
    const last = lines[lines.length - 1]
    const convo = await Conversation.create({
      buyer: buyer[buyerKey]._id, seller: sellerUser._id, shop: shopBy[sellerKey]._id,
      lastMessage: last[1], lastMessageAt: daysFromNow(0, 10),
      buyerUnread: last[0] === 'seller' ? 1 : 0, sellerUnread: last[0] === 'buyer' ? 1 : 0,
    })
    await Message.insertMany(lines.map(([who, text], i) => ({
      conversation: convo._id, sender: who === 'buyer' ? buyer[buyerKey]._id : sellerUser._id, text,
      createdAt: new Date(daysFromNow(0, 9).getTime() + i * 5 * 60000),
    })))
  }

  // ratings, fulfilment, trust score - calculated the same way the app does it
  for (const s of shops) await updateShopStats(s._id)

  console.log(`Mock data added: ${sellers.length} sellers/shops, ${buyers.length} buyers, ${products.length} products, ` +
    `${savedOrders.length} orders, ${reviews.length} reviews, ${favDocs.length} favourites, ${interactions.length} interactions, ${CHATS.length} chats`)
  console.log(`Log in with e.g. alice${MOCK_DOMAIN} (buyer) or bob${MOCK_DOMAIN} (seller) - password: password123`)
  await mongoose.disconnect()
}

run().catch(async (err) => {
  console.error(err)
  await mongoose.disconnect()
  process.exit(1)
})
