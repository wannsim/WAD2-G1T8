import express from 'express'
import Shop from '../models/Shop.js'

// Owner: Cheyenne
// GET /shops   GET /shops/mine/:ownerId   GET /shops/:id   POST /shops   PUT /shops/:id
const router = express.Router()

// list all shops (the map uses this). The private street address is left out.
router.get('/', async (req, res) => {
  try {
    const shops = await Shop.find().select('-address -postalCode')
    res.json(shops)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// the logged-in seller's own shop (null if they have not created one yet)
// NOTE: must be defined BEFORE '/:id'
router.get('/mine/:ownerId', async (req, res) => {
  try {
    const shop = await Shop.findOne({ owner: req.params.ownerId })
    res.json(shop)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

router.get('/:id', async (req, res) => {
  try {
    const shop = await Shop.findById(req.params.id).select('-address -postalCode')
    if (!shop) return res.status(404).json({ message: 'Shop not found' })
    res.json(shop)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

router.post('/', async (req, res) => {
  try {
    const shop = await Shop.create(req.body)
    res.status(201).json(shop)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

router.put('/:id', async (req, res) => {
  try {
    // never let the client overwrite the owner or the trust stats
    const { owner, stats, ...changes } = req.body
    const shop = await Shop.findByIdAndUpdate(req.params.id, changes, { new: true, runValidators: true })
    if (!shop) return res.status(404).json({ message: 'Shop not found' })
    res.json(shop)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

export default router
