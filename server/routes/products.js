import express from 'express'
import multer from 'multer'
import mongoose from 'mongoose'
import Product from '../models/Product.js'
import { withImageUrl } from '../utils/images.js'

const router = express.Router()
const upload = multer({ storage: multer.memoryStorage() })

// Create Product/Service
router.post('/', upload.array('images', 5), async (req, res) => {
  try {
    const imageBase64Array = req.files.map(file => {
      const base64Data = file.buffer.toString('base64')
      return `data:${file.mimetype};base64,${base64Data}`
    })

    const tags = req.body.tags ? JSON.parse(req.body.tags) : []
    const orderSlots = req.body.orderSlots ? JSON.parse(req.body.orderSlots) : []

    const newProduct = new Product({
      shop: req.body.shopId,
      name: req.body.name,
      category: req.body.category,
      description: req.body.description,
      price: req.body.price,
      unit: req.body.unit,
      images: imageBase64Array,
      tags: tags,
      customisable: req.body.customisable === 'true' || req.body.customisable === true,
      isAvailable: req.body.isAvailable === 'true' || req.body.isAvailable === true,
      orderSlots: orderSlots
    })
    
    await newProduct.save()
    res.status(201).json(withImageUrl(req, newProduct))
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Get Products by Shop ID (photos are sent separately, see GET /:id/image/:index)
router.get('/shop/:shopId', async (req, res) => {
  try {
    const products = await Product.find({ shop: req.params.shopId })
      .select('-images')
      .sort({ createdAt: -1 })
      .lean()
    res.status(200).json(products.map((p) => withImageUrl(req, p)))
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Get one product (product page, order request page, edit form)
router.get('/:id', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'Product not found' })
    const product = await Product.findById(req.params.id)
      .select('-images')
      .populate('shop', 'name nearestMrt location stats pickup delivery owner followers')
      .lean()
    if (!product) return res.status(404).json({ message: 'Product not found' })
    res.json(withImageUrl(req, product))
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
})

// Serve one product photo as a real image (cached by the browser for a day)
router.get('/:id/image/:index', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.sendStatus(404)
    const index = Number(req.params.index) || 0
    // $slice only loads the one photo we need, not all of them
    const product = await Product.findById(req.params.id, { images: { $slice: [index, 1] } }).lean()
    const image = product?.images?.[0]
    if (!image) return res.sendStatus(404)

    const match = /^data:(.+?);base64,(.+)$/s.exec(image)
    if (!match) return res.redirect(image) // already a normal URL

    res.set('Content-Type', match[1])
    res.set('Cache-Control', 'public, max-age=86400')
    res.send(Buffer.from(match[2], 'base64'))
  } catch (error) {
    res.sendStatus(500)
  }
})

// Update Product / Order Slots
router.put('/:id', upload.array('images', 5), async (req, res) => {
  try {
    const updateData = {
      name: req.body.name,
      category: req.body.category,
      description: req.body.description,
      price: req.body.price,
      unit: req.body.unit,
      customisable: req.body.customisable === 'true' || req.body.customisable === true,
      isAvailable: req.body.isAvailable === 'true' || req.body.isAvailable === true,
    }

    if (req.body.tags) {
      updateData.tags = JSON.parse(req.body.tags)
    }
    if (req.body.orderSlots) {
      updateData.orderSlots = JSON.parse(req.body.orderSlots)
    }

    if (req.files && req.files.length > 0) {
      updateData.images = req.files.map(file => {
        const base64Data = file.buffer.toString('base64')
        return `data:${file.mimetype};base64,${base64Data}`
      })
    }

    const updatedProduct = await Product.findByIdAndUpdate(req.params.id, updateData, { new: true }).select('-images')
    if (!updatedProduct) return res.status(404).json({ error: 'Product not found' })
    res.status(200).json(withImageUrl(req, updatedProduct))
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})
export default router