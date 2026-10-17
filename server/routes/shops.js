import express from 'express'
import multer from 'multer'
import mongoose from 'mongoose'
import Shop from '../models/Shop.js'
import Product from '../models/Product.js'

// Owner: Cheyenne
// GET /shops   GET /shops/mine/:ownerId   GET /shops/:id   POST /shops   PUT /shops/:id   POST /shops/:id/follow
const router = express.Router()

// certificate photos: images only, max 5MB each
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(null, file.mimetype.startsWith('image/')),
})

// certificate photos are big Base64 strings - never send them inside the shop JSON
const NO_CERT_IMAGES = '-certificationFiles.image'

// list all shops (the map uses this). The private street address is left out.
router.get('/', async (req, res) => {
  try {
    const shops = await Shop.find().select(`-address -postalCode ${NO_CERT_IMAGES}`)
    res.json(shops)
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
    const { owner, stats, pinnedProduct, certificationFiles, ...changes } = req.body
    const shop = await Shop.findByIdAndUpdate(req.params.id, changes, { new: true, runValidators: true }).select(NO_CERT_IMAGES)
    if (!shop) return res.status(404).json({ message: 'Shop not found' })
    res.json(shop)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// pin one product to the top of the shop page (productId = null un-pins)
router.put('/:id/pin', async (req, res) => {
  try {
    const { productId } = req.body
    if (productId) {
      const product = await Product.findOne({ _id: productId, shop: req.params.id })
      if (!product) return res.status(400).json({ message: 'That product is not in this shop' })
    }
    const shop = await Shop.findByIdAndUpdate(req.params.id, { pinnedProduct: productId || null }, { new: true })
    if (!shop) return res.status(404).json({ message: 'Shop not found' })
    res.json(shop)
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
