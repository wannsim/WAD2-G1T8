import express from 'express'
import multer from 'multer'
import mongoose from 'mongoose'
import Shop from '../models/Shop.js'
import Product from '../models/Product.js'

// Owner: Cheyenne
// GET /shops   GET /shops/map   GET /shops/name-available   GET /shops/mine/:ownerId   GET /shops/:id   POST /shops   PUT /shops/:id   PUT /shops/:id/pin   POST /shops/:id/follow
const router = express.Router()

// certificate photos: images only, max 5MB each
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(null, file.mimetype.startsWith('image/')),
})

// certificate photos are big Base64 strings - never send them inside the shop JSON
const NO_CERT_IMAGES = '-certificationFiles.image'

// Shop names must be unique (ignoring upper/lower case and extra spaces), so buyers can tell shops apart.
// returns an error message, or '' if the name is OK. exceptShopId = the shop being renamed (it may keep its own name)
const cleanName = (name) => String(name ?? '').trim().replace(/\s+/g, ' ')
const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
async function checkShopName(name, exceptShopId) {
  if (!name) return 'Shop name is required.'
  if (name.length > 60) return 'Shop name is too long (max 60 characters).'
  const query = { name: new RegExp(`^${escapeRegex(name)}$`, 'i') }
  if (exceptShopId) query._id = { $ne: exceptShopId }
  if (await Shop.exists(query)) return `The shop name "${name}" is already taken. Please choose another name.`
  return ''
}

// list all shops (the map uses this). The private street address is left out.
router.get('/', async (req, res) => {
  try {
    const shops = await Shop.find().select(`-address -postalCode ${NO_CERT_IMAGES}`)
    res.json(shops)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// shops for the map page: public fields + starting price and number of listings
// NOTE: must be defined BEFORE '/:id'
router.get('/map', async (req, res) => {
  try {
    const [shops, prices] = await Promise.all([
      Shop.find().select('name nearestMrt categories description stats location').lean(),
      Product.aggregate([
        { $match: { isAvailable: { $ne: false } } },
        { $group: { _id: '$shop', minPrice: { $min: '$price' }, listingCount: { $sum: 1 } } },
      ]),
    ])
    const byShop = new Map(prices.map((p) => [String(p._id), p]))
    res.json(shops.map((shop) => {
      const p = byShop.get(String(shop._id))
      return { ...shop, minPrice: p ? p.minPrice : null, listingCount: p ? p.listingCount : 0 }
    }))
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// Public shop cards for a buyer's following list.
router.get('/following/:userId', async (req, res) => {
  try {
    const shops = await Shop.find({ followers: req.params.userId })
      .select('name nearestMrt categories stats')
      .sort({ name: 1 })
    res.json(shops)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// is a shop name free? ?name=...&except=<my shop id>  -> { available, message }
// NOTE: must be defined BEFORE '/:id'
router.get('/name-available', async (req, res) => {
  try {
    const except = mongoose.isValidObjectId(req.query.except) ? req.query.except : undefined
    const message = await checkShopName(cleanName(req.query.name), except)
    res.json({ available: !message, message })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// the logged-in seller's own shop (null if they have not created one yet)
// NOTE: must be defined BEFORE '/:id'
router.get('/mine/:ownerId', async (req, res) => {
  try {
    const shop = await Shop.findOne({ owner: req.params.ownerId }).select(NO_CERT_IMAGES)
    res.json(shop)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

router.get('/:id', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'Shop not found' })
    const shop = await Shop.findById(req.params.id).select(`-address -postalCode ${NO_CERT_IMAGES}`)
    if (!shop) return res.status(404).json({ message: 'Shop not found' })
    res.json(shop)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

router.post('/', async (req, res) => {
  try {
    const { certificationFiles, ...data } = req.body // photos are uploaded separately
    data.name = cleanName(data.name)
    const problem = await checkShopName(data.name)
    if (problem) return res.status(409).json({ message: problem })
    const shop = await Shop.create(data)
    res.status(201).json(shop)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

router.put('/:id', async (req, res) => {
  try {
    // never let the client overwrite the owner or the trust stats
    // certificate photos have their own routes below, so they can't be wiped by a profile save
    const { owner, stats, pinnedProducts, followers, certificationFiles, ...changes } = req.body
    if ('name' in changes) {
      if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'Shop not found' })
      changes.name = cleanName(changes.name)
      const problem = await checkShopName(changes.name, req.params.id)
      if (problem) return res.status(409).json({ message: problem })
    }
    const shop = await Shop.findByIdAndUpdate(req.params.id, changes, { new: true, runValidators: true }).select(NO_CERT_IMAGES)
    if (!shop) return res.status(404).json({ message: 'Shop not found' })
    res.json(shop)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// pin / un-pin a product (toggles). Pinned products show first on the shop page.
// body: { user, productId }   user must be the shop owner
const MAX_PINS = 3
router.put('/:id/pin', async (req, res) => {
  try {
    const { user, productId } = req.body
    if (!mongoose.isValidObjectId(req.params.id) || !mongoose.isValidObjectId(productId)) {
      return res.status(400).json({ message: 'Invalid shop or product' })
    }
    const shop = await Shop.findById(req.params.id).select('owner pinnedProducts')
    if (!shop) return res.status(404).json({ message: 'Shop not found' })
    if (String(shop.owner) !== String(user)) return res.status(403).json({ message: 'Only the shop owner can pin products' })

    const product = await Product.findOne({ _id: productId, shop: req.params.id }).select('_id')
    if (!product) return res.status(400).json({ message: 'That product is not in this shop' })

    const pinned = shop.pinnedProducts.some((p) => String(p) === String(productId))
    if (!pinned && shop.pinnedProducts.length >= MAX_PINS) {
      return res.status(400).json({ message: `You can pin up to ${MAX_PINS} products. Unpin one first.` })
    }
    const updated = await Shop.findByIdAndUpdate(
      req.params.id,
      pinned ? { $pull: { pinnedProducts: productId } } : { $addToSet: { pinnedProducts: productId } },
      { new: true }
    ).select('pinnedProducts')
    res.json({ pinned: !pinned, pinnedProducts: updated.pinnedProducts })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// follow / unfollow a shop (toggles). body: { user }
router.post('/:id/follow', async (req, res) => {
  try {
    const { user } = req.body
    if (!mongoose.isValidObjectId(user)) return res.status(400).json({ message: 'Log in to follow shops' })
    const shop = await Shop.findById(req.params.id).select('owner followers')
    if (!shop) return res.status(404).json({ message: 'Shop not found' })
    if (String(shop.owner) === String(user)) return res.status(400).json({ message: "You can't follow your own shop" })

    const following = !shop.followers.some((f) => String(f) === String(user))
    // $addToSet / $pull so double-clicks can't add the same follower twice
    const updated = await Shop.findByIdAndUpdate(
      req.params.id,
      following ? { $addToSet: { followers: user } } : { $pull: { followers: user } },
      { new: true }
    ).select('followers')
    await Shop.updateOne({ _id: req.params.id }, { 'stats.followerCount': updated.followers.length })
    res.json({ following, followerCount: updated.followers.length })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// upload one certificate photo. multipart form: name (text) + image (file)
// turns multer errors (e.g. file too big) into a normal JSON message
function uploadCertImage(req, res, next) {
  upload.single('image')(req, res, (err) => {
    if (!err) return next()
    const message = err.code === 'LIMIT_FILE_SIZE' ? 'Image is too big (max 5MB)' : err.message
    res.status(400).json({ message })
  })
}

router.post('/:id/certs', uploadCertImage, async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'Please choose an image file (max 5MB)' })
    const image = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`
    const shop = await Shop.findByIdAndUpdate(
      req.params.id,
      { $push: { certificationFiles: { name: req.body.name || req.file.originalname, image } } },
      { new: true }
    ).select(NO_CERT_IMAGES)
    if (!shop) return res.status(404).json({ message: 'Shop not found' })
    res.status(201).json(shop.certificationFiles)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// remove one certificate photo
router.delete('/:id/certs/:certId', async (req, res) => {
  try {
    const shop = await Shop.findByIdAndUpdate(
      req.params.id,
      { $pull: { certificationFiles: { _id: req.params.certId } } },
      { new: true }
    ).select(NO_CERT_IMAGES)
    if (!shop) return res.status(404).json({ message: 'Shop not found' })
    res.json(shop.certificationFiles)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// serve one certificate photo as a real image (cached by the browser)
router.get('/:id/certs/:certId/image', async (req, res) => {
  try {
    const { id, certId } = req.params
    if (!mongoose.isValidObjectId(id) || !mongoose.isValidObjectId(certId)) return res.sendStatus(404)
    const shop = await Shop.findOne({ _id: id }, { certificationFiles: { $elemMatch: { _id: certId } } }).lean()
    const image = shop?.certificationFiles?.[0]?.image
    if (!image) return res.sendStatus(404)

    const match = /^data:(.+?);base64,(.+)$/s.exec(image)
    if (!match) return res.sendStatus(404)
    res.set('Content-Type', match[1])
    res.set('Cache-Control', 'public, max-age=604800') // a cert id never changes its photo
    res.send(Buffer.from(match[2], 'base64'))
  } catch (err) {
    res.sendStatus(500)
  }
})

export default router
