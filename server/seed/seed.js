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

// Fills YOUR database with sample data so everyone can test with the same accounts.
//   pnpm seed
// WARNING: this DELETES everything in the database named in config.env first.
dotenv.config({ path: './config.env' })

const inDays = (d, hour = 14) => {
  const t = new Date()
  t.setDate(t.getDate() + d)
  t.setHours(hour, 0, 0, 0)
  return t
}

async function seed() {
  await mongoose.connect(process.env.DB)
  await Promise.all(
    [User, Shop, Product, Order, Review, Interaction, Favourite].map((m) => m.deleteMany({}))
  )

  const password = await bcrypt.hash('password123', 10)
  const [alice, bob, cara] = await User.create([
    { name: 'Alice Buyer', email: 'alice@test.com', password, role: 'buyer', preferences: ['Baked goods'] },
    { name: 'Bob Baker', email: 'bob@test.com', password, role: 'seller' },
    { name: 'Cara Crafts', email: 'cara@test.com', password, role: 'seller' },
  ])

  const [bobShop, caraShop] = await Shop.create([
    {
      owner: bob._id, name: "Bob's Bakes", description: 'Small-batch cookies and cakes from my home kitchen.',
      nearestMrt: 'Bishan', postalCode: '570000', location: { lat: 1.35, lng: 103.85 }, pickup: true, delivery: true,
    },
    {
      owner: cara._id, name: "Cara's Crafts", description: 'Handmade candles and keychains.',
      nearestMrt: 'Tampines', postalCode: '520000', location: { lat: 1.35, lng: 103.94 }, pickup: true, delivery: false,
    },
  ])

  await Product.create([
    { shop: bobShop._id, name: 'Chocolate Chip Cookies', category: 'Baked goods', price: 12, unit: 'box of 12',
      description: 'Chewy cookies, baked to order.', tags: ['cookies', 'chocolate'], customisable: false,
      orderSlots: [{ start: inDays(2), capacity: 3 }, { start: inDays(3), capacity: 3 }] },
    { shop: bobShop._id, name: 'Custom Birthday Cake', category: 'Baked goods', price: 55, unit: '6-inch cake',
      description: 'Tell me your flavour and message.', tags: ['cake', 'birthday'], customisable: true,
      orderSlots: [{ start: inDays(5, 11), capacity: 1 }] },
    { shop: caraShop._id, name: 'Soy Candle', category: 'Handmade crafts', price: 18, unit: 'piece',
      description: 'Hand-poured, lavender scent.', tags: ['candle', 'gift'], customisable: true,
      orderSlots: [{ start: inDays(4), capacity: 5 }] },
    { shop: caraShop._id, name: 'Beaded Keychain', category: 'Handmade crafts', price: 6, unit: 'piece',
      description: 'Pick your colours.', tags: ['keychain'], customisable: true,
      orderSlots: [{ start: inDays(4), capacity: 10 }] },
  ])

  console.log('Seed done. Log in with alice@test.com / bob@test.com / cara@test.com  (password: password123)')
  await mongoose.disconnect()
}

seed().catch((err) => {
  console.error(err)
  process.exit(1)
})
