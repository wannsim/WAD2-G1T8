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

// ---------- 6 more shops (50 more products, real photos from Wikimedia Commons - see seed/images/CREDITS.md) ----------
const MORE_SELLERS = [
  { name: 'Mei Ling Tan', email: 'mei', shop: "Auntie Mei's Kitchen", mrt: 'Hougang', lat: 1.3712, lng: 103.8925, postal: '530111',
    categories: ['Meals'], delivery: true, desc: 'Hawker favourites cooked at home - the way my family has made them for 30 years.' },
  { name: 'Jason Lim', email: 'jason', shop: 'Little Oven Co', mrt: 'Serangoon', lat: 1.3498, lng: 103.8737, postal: '550222',
    categories: ['Baked goods'], delivery: true, desc: 'Sourdough, viennoiserie and cakes baked in small batches every morning.' },
  { name: 'Nur Aisyah', email: 'aisyah', shop: 'Sip Sip Hooray', mrt: 'Ang Mo Kio', lat: 1.37, lng: 103.8495, postal: '560333',
    categories: ['Drinks'], delivery: true, desc: 'Fresh local drinks, kombucha and bubble tea kits - less sugar, more flavour.' },
  { name: 'Kelvin Goh', email: 'kelvin', shop: 'Snack Shack SG', mrt: 'Sengkang', lat: 1.3917, lng: 103.8954, postal: '540444',
    categories: ['Snacks & desserts', 'Baked goods'], delivery: false, desc: 'Old-school kueh and festive snacks, made by hand in Sengkang.' },
  { name: 'Priya Nair', email: 'priya', shop: 'Knot & Thread', mrt: 'Yishun', lat: 1.4295, lng: 103.835, postal: '760555',
    categories: ['Handmade crafts'], delivery: true, desc: 'Macrame, knits, ceramics and other slow-made things for your home.' },
  { name: 'Rachel Koh', email: 'rachel', shop: 'Studio Sundays', mrt: 'Pasir Ris', lat: 1.373, lng: 103.9493, postal: '510666',
    categories: ['Others', 'Handmade crafts'], delivery: false, desc: 'Weekend art and baking workshops, plus plant and flower arrangements.' },
]
SELLERS.push(...MORE_SELLERS)

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

// the 50 extra products (one real photo each)
Object.assign(PRODUCTS, {
  mei: [
    ['Hainanese Chicken Rice', 'Meals', 6.5, 'set', '🍗', 'Poached chicken, fragrant rice, chilli and ginger sauce.', ['chicken rice', 'hawker', 'rice'], false, 1],
    ['Nasi Lemak', 'Meals', 7, 'set', '🍚', 'Coconut rice with sambal, fried chicken, egg, anchovies and peanuts.', ['nasi lemak', 'malay', 'spicy'], false, 1],
    ['Laksa', 'Meals', 8, 'bowl', '🍜', 'Rich coconut curry broth with thick noodles, prawns and tau pok.', ['laksa', 'noodles', 'spicy'], false, 1],
    ['Char Kway Teow', 'Meals', 7.5, 'plate', '🍳', 'Wok-fried flat noodles with prawns, egg, cockles and chinese sausage.', ['noodles', 'hawker', 'wok'], true, 1],
    ['Mee Siam', 'Meals', 6, 'plate', '🍝', 'Tangy, spicy rice vermicelli with egg, tau pok and lime.', ['noodles', 'malay', 'spicy'], false, 1],
    ['Bak Kut Teh', 'Meals', 9, 'bowl', '🍲', 'Peppery pork rib soup, served with rice and you tiao.', ['soup', 'pork', 'hawker'], false, 1],
    ['Fish Head Curry', 'Meals', 28, 'pot (2-3 pax)', '🐟', 'Red snapper head in tangy curry with okra and brinjal.', ['curry', 'seafood', 'spicy'], false, 1],
    ['Hokkien Mee', 'Meals', 8, 'plate', '🦐', 'Prawn-stock fried noodles with squid, pork belly and sambal.', ['noodles', 'seafood', 'hawker'], false, 1],
  ],
  jason: [
    ['Sourdough Loaf', 'Baked goods', 12, 'loaf', '🍞', '48-hour fermented country loaf with a crackly crust.', ['bread', 'sourdough'], false, 1],
    ['Basque Burnt Cheesecake', 'Baked goods', 42, '6-inch cake', '🍰', 'Caramelised outside, molten creamy middle.', ['cheesecake', 'cake', 'dessert'], true, 1],
    ['Butter Croissants', 'Baked goods', 15, 'box of 4', '🥐', 'Laminated with French butter, 27 flaky layers.', ['croissant', 'pastry', 'breakfast'], false, 1],
    ['Cinnamon Rolls', 'Baked goods', 16, 'box of 4', '🌀', 'Soft brioche swirls with cinnamon sugar and cream cheese glaze.', ['pastry', 'cinnamon', 'breakfast'], false, 1],
    ['Portuguese Egg Tarts', 'Baked goods', 14, 'box of 6', '🥧', 'Blistered custard in crisp puff pastry, best eaten warm.', ['tarts', 'custard', 'pastry'], false, 1],
    ['Fudgy Brownies', 'Baked goods', 18, 'box of 9', '🍫', 'Dark chocolate brownies with a shiny crackle top.', ['brownies', 'chocolate', 'dessert'], true, 1],
    ['Rosemary Focaccia', 'Baked goods', 13, 'tray', '🫓', 'Olive oil focaccia with fresh rosemary and sea salt.', ['bread', 'italian'], false, 1],
    ['Lemon Drizzle Cake', 'Baked goods', 22, 'loaf cake', '🍋', 'Zesty lemon sponge soaked with lemon syrup.', ['cake', 'lemon', 'tea time'], false, 1],
    ['Blueberry Muffins', 'Baked goods', 15, 'box of 6', '🫐', 'Bursting with blueberries and topped with crumble.', ['muffins', 'blueberry', 'breakfast'], false, 1],
  ],
  aisyah: [
    ['Rose Bandung', 'Drinks', 4, '500ml bottle', '🌹', 'Rose syrup and milk, the pink drink of every hari raya.', ['bandung', 'local', 'rose'], false, 1],
    ['Ginger Kombucha', 'Drinks', 8, '500ml bottle', '🫙', 'Small-batch fermented tea with fresh ginger. Lightly fizzy.', ['kombucha', 'healthy', 'ginger'], false, 1],
    ['Iced Lemon Tea', 'Drinks', 4.5, '500ml bottle', '🧊', 'Freshly brewed black tea with real lemon juice.', ['tea', 'lemon', 'refreshing'], true, 1],
    ['Brown Sugar Boba Kit', 'Drinks', 18, 'kit (6 cups)', '🧋', 'Tapioca pearls, brown sugar syrup and tea - make bubble tea at home.', ['bubble tea', 'boba', 'kit'], false, 1],
    ['Soya Bean Milk', 'Drinks', 3.5, '1L bottle', '🥛', 'Freshly ground soya beans, less sweet. Made every morning.', ['soy', 'healthy', 'local'], true, 1],
    ['Iced Matcha Latte', 'Drinks', 6.5, '400ml bottle', '🍵', 'Ceremonial-grade matcha over fresh milk.', ['matcha', 'latte'], true, 1],
    ['Sugarcane Juice', 'Drinks', 4, '500ml bottle', '🎋', 'Freshly pressed sugarcane with a squeeze of lemon.', ['juice', 'local', 'refreshing'], false, 1],
    ['Calamansi Juice', 'Drinks', 3.5, '500ml bottle', '🍊', 'Sweet and sour calamansi with sour plum.', ['juice', 'local', 'calamansi'], false, 1],
  ],
  kelvin: [
    ['Curry Puffs', 'Snacks & desserts', 10, 'box of 6', '🥟', 'Flaky spiral pastry filled with curry potato, chicken and egg.', ['curry puff', 'snacks', 'local'], false, 1],
    ['Muah Chee', 'Snacks & desserts', 6, 'box', '🥜', 'Soft glutinous rice dough tossed in crushed peanuts and sugar.', ['muah chee', 'peanut', 'local'], false, 1],
    ['Love Letters', 'Snacks & desserts', 16, 'tin of 40', '📜', 'Thin crispy coconut egg rolls, a CNY classic.', ['love letters', 'cny', 'festive'], false, 1],
    ['Kuih Bangkit', 'Snacks & desserts', 18, 'tub of 50', '🌼', 'Melt-in-your-mouth tapioca and coconut cookies.', ['kuih', 'cny', 'festive'], false, 1],
    ['Kueh Salat', 'Snacks & desserts', 14, 'tray', '🟩', 'Pandan custard on blue pea glutinous rice.', ['kueh', 'pandan', 'peranakan'], false, 1],
    ['Chendol', 'Snacks & desserts', 5, 'cup', '🍧', 'Shaved ice, pandan jelly, red bean, coconut milk and gula melaka.', ['chendol', 'dessert', 'local'], false, 1],
    ['Bubur Cha Cha', 'Snacks & desserts', 5, 'bowl', '🥣', 'Sweet potato, yam and sago in warm coconut milk.', ['dessert', 'coconut', 'local'], false, 1],
    ['Tang Yuan', 'Snacks & desserts', 6, 'bowl of 8', '🍡', 'Glutinous rice balls with black sesame filling in ginger soup.', ['tang yuan', 'dessert', 'festive'], false, 1],
    ['Pandan Chiffon Cake', 'Baked goods', 16, 'whole cake', '🎂', 'Fluffy chiffon made with fresh pandan juice and coconut milk.', ['cake', 'pandan', 'local'], false, 1],
  ],
  priya: [
    ['Macrame Wall Hanging', 'Handmade crafts', 38, 'piece', '🪢', 'Hand-knotted cotton cord on a wooden dowel, 60cm long.', ['macrame', 'home', 'decor'], true, 1],
    ['Hand-knitted Snood', 'Handmade crafts', 32, 'piece', '🧣', 'Chunky ribbed snood in soft merino. Choose your colour.', ['knit', 'gift', 'winter'], true, 1],
    ['Ceramic Coffee Mug', 'Handmade crafts', 28, 'piece', '☕', 'Wheel-thrown stoneware mug with hand-painted stars.', ['ceramics', 'mug', 'gift'], true, 1],
    ['Crochet Coasters', 'Handmade crafts', 15, 'set of 4', '🧶', 'Thick cotton coasters in stripes, machine washable.', ['crochet', 'home', 'gift'], true, 1],
    ['Beaded Bracelet', 'Handmade crafts', 12, 'piece', '📿', 'Glass seed beads woven in a geometric pattern.', ['jewellery', 'beads', 'gift'], true, 1],
    ['Embroidery Hoop Art', 'Handmade crafts', 35, 'piece', '🪡', 'Hand-stitched floral embroidery framed in a 20cm hoop.', ['embroidery', 'art', 'decor'], true, 1],
    ['Canvas Tote Bag', 'Handmade crafts', 24, 'piece', '👜', 'Sturdy striped canvas tote with an inner pocket.', ['bag', 'tote', 'gift'], false, 1],
    ['Handmade Soap Bars', 'Handmade crafts', 18, 'set of 3', '🧼', 'Cold-process soap with shea butter and essential oils.', ['soap', 'self care', 'gift'], false, 1],
    ['Pressed Flower Art', 'Handmade crafts', 30, 'A4 frame', '🌸', 'Real flowers and leaves pressed and arranged by hand.', ['flowers', 'art', 'decor'], true, 1],
  ],
  rachel: [
    ['Watercolour Workshop', 'Others', 65, 'session (3 hours)', '🎨', 'Beginner-friendly watercolour class. All materials provided.', ['workshop', 'art', 'class'], false, 1],
    ['Pottery Wheel Class', 'Others', 85, 'session (2 hours)', '🏺', 'Try the pottery wheel and make two pieces to take home.', ['workshop', 'pottery', 'class'], false, 1],
    ['Bread Baking Class', 'Others', 70, 'session (3 hours)', '👩‍🍳', 'Learn to knead, shape and bake your own loaf.', ['workshop', 'baking', 'class'], false, 1],
    ['Modern Calligraphy Lesson', 'Others', 55, 'session (2 hours)', '✒️', 'Learn the basics of pointed-pen lettering. Starter kit included.', ['workshop', 'calligraphy', 'class'], false, 1],
    ['Terrarium Kit', 'Handmade crafts', 45, 'kit', '🌿', 'Glass bowl, soil, moss and succulents to build your own terrarium.', ['plants', 'terrarium', 'kit'], false, 1],
    ['Succulent Arrangement', 'Others', 25, 'pot', '🪴', 'Low-maintenance succulent in a matte ceramic pot.', ['plants', 'gift', 'home'], true, 1],
    ['Fresh Flower Bouquet', 'Others', 48, 'bouquet', '💐', 'Seasonal roses and carnations, arranged on the day.', ['flowers', 'gift', 'occasion'], true, 1],
  ],
})

// ---------- buyers ----------
const BUYERS = [
  { name: 'Alice Lee', email: 'alice', preferences: ['Baked goods', 'Snacks & desserts'] },
  { name: 'Ben Ong', email: 'ben', preferences: ['Meals', 'Drinks'] },
  { name: 'Chloe Teo', email: 'chloe', preferences: ['Handmade crafts'] },
  { name: 'Daniel Yeo', email: 'daniel', preferences: [] }, // new user - tests the FYP with no preferences
  { name: 'Farah Ismail', email: 'farah', preferences: ['Meals', 'Snacks & desserts'] },
  { name: 'Gabriel Chen', email: 'gabriel', preferences: ['Baked goods', 'Drinks'] },
  { name: 'Hannah Lee', email: 'hannah', preferences: ['Handmade crafts', 'Others'] },
  { name: 'Irfan Hakim', email: 'irfan', preferences: ['Meals', 'Drinks'] },
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
    ['ben', 'Lemongrass Ginger Tea', 'declined', 3, null, null, { reason: 'Sorry, I am out of lemongrass this week.' }],
    ['chloe', 'Ondeh Ondeh', 'cancelled', 4, null, null, { cancelledBy: 'buyer', reason: 'My plans changed, I cannot pick it up anymore.' }],
    ['alice', 'Teh Tarik Kit', 'cancelled', 6, null, null, { cancelledBy: 'seller', reason: 'I fell sick and cannot make this order in time.' }],
    // ----- the 6 extra shops -----
    ['farah', 'Nasi Lemak', 'completed', 21, 5, 'Sambal is shiok! Tastes just like the ones at Adam Road.'],
    ['irfan', 'Nasi Lemak', 'completed', 9, 4, 'Chicken wing was crispy, rice could be more lemak.'],
    ['ben', 'Laksa', 'completed', 17, 5, 'Thick and rich gravy, generous with the prawns.'],
    ['irfan', 'Hainanese Chicken Rice', 'completed', 13, 5, 'Silky chicken and the chilli has a good kick.'],
    ['farah', 'Char Kway Teow', 'completed', 8, 4, 'Good wok hei. Asked for no cockles and she remembered.'],
    ['ben', 'Bak Kut Teh', 'completed', 6, 5, 'Very peppery, exactly how I like it.'],
    ['gabriel', 'Fish Head Curry', 'completed', 24, 4, 'Big portion, enough for my family of four.'],
    ['gabriel', 'Sourdough Loaf', 'completed', 19, 5, 'Proper crust and open crumb. Best sourdough in the east.'],
    ['alice', 'Basque Burnt Cheesecake', 'completed', 15, 5, 'Creamy centre, not too sweet. Everyone at the party asked where it was from.'],
    ['gabriel', 'Butter Croissants', 'completed', 10, 5, 'Flaky and buttery, shattered everywhere in the best way.'],
    ['chloe', 'Cinnamon Rolls', 'completed', 12, 4, 'Soft and gooey, a little too much icing for me.'],
    ['alice', 'Portuguese Egg Tarts', 'completed', 7, 5, 'Still warm when I collected them!'],
    ['farah', 'Fudgy Brownies', 'completed', 16, 3, 'Tasty but a bit too dense this batch.'],
    ['gabriel', 'Blueberry Muffins', 'completed', 4, 4, 'Lots of blueberries, nice crumble top.'],
    ['irfan', 'Brown Sugar Boba Kit', 'completed', 14, 5, 'Pearls turned out chewy, my kids loved making it.'],
    ['gabriel', 'Ginger Kombucha', 'completed', 20, 4, 'Nice fizz and strong ginger. Will try other flavours.'],
    ['ben', 'Sugarcane Juice', 'completed', 11, 5, 'Fresh and not watered down.'],
    ['farah', 'Rose Bandung', 'completed', 5, 5, 'Brings back hari raya memories.'],
    ['irfan', 'Soya Bean Milk', 'completed', 3, 4, 'Smooth and less sweet as promised.'],
    ['farah', 'Curry Puffs', 'completed', 18, 5, 'Crispy spiral pastry and a whole quail egg inside!'],
    ['alice', 'Kueh Salat', 'completed', 22, 5, 'Perfect balance of pandan custard and rice.'],
    ['chloe', 'Muah Chee', 'completed', 10, 4, 'Soft and chewy, generous peanuts.'],
    ['hannah', 'Love Letters', 'completed', 26, 5, 'Thin and crispy, bought another tin for my grandma.'],
    ['farah', 'Chendol', 'completed', 6, 4, 'Gula melaka is legit. Would be nice to have durian option.'],
    ['alice', 'Pandan Chiffon Cake', 'completed', 9, 5, 'So fluffy and fragrant.'],
    ['hannah', 'Macrame Wall Hanging', 'completed', 27, 5, 'Priya customised the length for my wall. Beautiful work.'],
    ['chloe', 'Ceramic Coffee Mug', 'completed', 15, 5, 'Each mug is slightly different, love the hand-painted stars.'],
    ['hannah', 'Crochet Coasters', 'completed', 12, 4, 'Cute and thick, they absorb well.'],
    ['chloe', 'Embroidery Hoop Art', 'completed', 21, 5, 'Gave it as a birthday gift, my friend teared up.'],
    ['hannah', 'Handmade Soap Bars', 'completed', 8, 4, 'Smells lovely, lather is a bit light.'],
    ['hannah', 'Pottery Wheel Class', 'completed', 16, 5, 'Rachel is so patient. Came home with two wonky but lovely bowls.'],
    ['chloe', 'Watercolour Workshop', 'completed', 23, 5, 'Relaxing Sunday afternoon, everything provided.'],
    ['gabriel', 'Bread Baking Class', 'completed', 13, 4, 'Learnt a lot, class could be a little smaller.'],
    ['hannah', 'Terrarium Kit', 'completed', 7, 5, 'Easy instructions and good quality plants.'],
    ['alice', 'Fresh Flower Bouquet', 'completed', 11, 5, 'Fresh flowers that lasted over a week.'],
    ['irfan', 'Mee Siam', 'completed', 2], // completed, not reviewed yet
    ['farah', 'Hokkien Mee', 'pending', 0],
    ['gabriel', 'Lemon Drizzle Cake', 'accepted', 1],
    ['hannah', 'Beaded Bracelet', 'pending', 0],
    ['irfan', 'Iced Matcha Latte', 'rescheduled', 1],
    ['ben', 'Calamansi Juice', 'declined', 2],
    ['chloe', 'Modern Calligraphy Lesson', 'accepted', 2],
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
  const FOLLOWS = {
    alice: ['bob', 'ella', 'grace', 'jason'], ben: ['dinesh', 'farid', 'mei'], chloe: ['cara', 'ivy', 'bob', 'priya'],
    farah: ['mei', 'kelvin', 'aisyah'], gabriel: ['jason', 'aisyah', 'bob'], hannah: ['priya', 'rachel', 'cara'], irfan: ['mei', 'aisyah', 'dinesh'],
  }
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
    farah: ['Nasi Lemak', 'Curry Puffs', 'Chendol', 'Laksa'],
    gabriel: ['Sourdough Loaf', 'Butter Croissants', 'Ginger Kombucha'],
    hannah: ['Macrame Wall Hanging', 'Pottery Wheel Class', 'Pressed Flower Art', 'Terrarium Kit'],
    irfan: ['Hainanese Chicken Rice', 'Brown Sugar Boba Kit', 'Bak Kut Teh'],
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
    farah: ['Mee Siam', 'Kuih Bangkit', 'Tang Yuan', 'Fish Head Curry'],
    gabriel: ['Basque Burnt Cheesecake', 'Rosemary Focaccia', 'Iced Lemon Tea'],
    hannah: ['Hand-knitted Snood', 'Canvas Tote Bag', 'Watercolour Workshop', 'Succulent Arrangement'],
    irfan: ['Char Kway Teow', 'Sugarcane Juice', 'Calamansi Juice'],
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
  const SEARCHES = {
    alice: ['cake', 'mochi', 'kueh'], ben: ['biryani', 'coffee', 'spicy'], chloe: ['candle', 'gift', 'crochet'],
    farah: ['nasi lemak', 'kueh'], gabriel: ['sourdough', 'croissant'], hannah: ['workshop', 'macrame'], irfan: ['chicken rice', 'boba'],
  }
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
