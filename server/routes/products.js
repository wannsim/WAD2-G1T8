import express from 'express'
import multer from 'multer'
import mongoose from 'mongoose'
import Product from '../models/Product.js'
import Shop from '../models/Shop.js'
import Favourite from '../models/Favourite.js'
import Interaction from '../models/Interaction.js'
import { withImageUrl, imageCounts } from '../utils/images.js'
import { checkProduct, toPrice, cleanTags } from '../utils/productRules.js'
import { notify } from '../utils/notify.js'

// buyers who saved this product (to tell them it is sold out / deleted)
async function favouritedBy(productId) {
  const favs = await Favourite.find({ product: productId }).select('user').lean()
  return favs.map((f) => f.user)
}

const router = express.Router()
const upload = multer({ storage: multer.memoryStorage() })

// Create Product/Service. body also has { shopId, user }   user must own the shop
// (a seller can only list products after setting up their shop profile)
router.post('/', upload.array('images', 5), async (req, res) => {
  try {
    const shop = mongoose.isValidObjectId(req.body.shopId) ? await Shop.findById(req.body.shopId).select('owner name followers').lean() : null
    if (!shop) return res.status(400).json({ error: 'Please set up your shop profile before adding products.' })
    if (String(shop.owner) !== String(req.body.user)) return res.status(403).json({ error: 'You can only add products to your own shop.' })

    const problem = checkProduct(req.body, { missingImage: !req.files || req.files.length === 0 })
    if (problem) return res.status(400).json({ error: problem })

    const imageBase64Array = req.files.map(file => {
      const base64Data = file.buffer.toString('base64')
      return `data:${file.mimetype};base64,${base64Data}`
    })

    const tags = cleanTags(req.body.tags ? JSON.parse(req.body.tags) : [])
    const orderSlots = req.body.orderSlots ? JSON.parse(req.body.orderSlots) : []

    const newProduct = new Product({
      shop: req.body.shopId,
      name: req.body.name.trim(),
      category: req.body.category,
      description: req.body.description.trim(),
      price: toPrice(req.body.price),
      unit: req.body.unit,
      images: imageBase64Array,
      tags: tags,
      customisable: req.body.customisable === 'true' || req.body.customisable === true,
      isAvailable: req.body.isAvailable === 'true' || req.body.isAvailable === true,
      orderSlots: orderSlots
    })
    
    await newProduct.save()
    if (newProduct.isAvailable) {
      // tell the shop's followers about the new item
      await notify(req, (shop.followers || []).filter((f) => String(f) !== String(shop.owner)), {
        type: 'new-product',
        title: `${shop.name} added a new item`,
        message: `${newProduct.name} - $${newProduct.price.toFixed(2)} / ${newProduct.unit}`,
        link: `/products/${newProduct._id}`,
        product: newProduct._id,
      })
    }
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
    const counts = await imageCounts(products.map((p) => p._id)) // for the photo carousel
    res.set('Cache-Control', 'no-store') // always get the latest list after an add / edit / delete
    res.status(200).json(products.map((p) => withImageUrl(req, p, counts.get(String(p._id)))))
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
      .populate('shop', 'name nearestMrt location stats pickup delivery owner followers categories createdAt')
      .lean()
    if (!product) return res.status(404).json({ message: 'Product not found' })
    const counts = await imageCounts([product._id]) // product page shows every photo
    res.json(withImageUrl(req, product, counts.get(String(product._id))))
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
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Product not found' })
    const problem = checkProduct(req.body)
    if (problem) return res.status(400).json({ error: problem })

    const updateData = {
      name: req.body.name.trim(),
      category: req.body.category,
      description: req.body.description.trim(),
      price: toPrice(req.body.price),
      unit: req.body.unit,
      customisable: req.body.customisable === 'true' || req.body.customisable === true,
      isAvailable: req.body.isAvailable === 'true' || req.body.isAvailable === true,
    }

    if (req.body.tags) {
      updateData.tags = cleanTags(JSON.parse(req.body.tags))
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

    const before = await Product.findById(req.params.id).select('isAvailable').lean()
    const updatedProduct = await Product.findByIdAndUpdate(req.params.id, updateData, { new: true }).select('-images').lean()
    if (!updatedProduct) return res.status(404).json({ error: 'Product not found' })
    if (before && before.isAvailable !== false && updatedProduct.isAvailable === false) {
      // just became unavailable -> tell buyers who saved it
      await notify(req, await favouritedBy(updatedProduct._id), {
        type: 'favourite-unavailable',
        title: `${updatedProduct.name} is sold out`,
        message: 'An item in your favourites is no longer available.',
        product: updatedProduct._id,
      })
    }
    const counts = await imageCounts([updatedProduct._id]) // keep the photo carousel right after an edit
    res.status(200).json(withImageUrl(req, updatedProduct, counts.get(String(updatedProduct._id))))
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Delete a product. body: { user }   user must own the product's shop
// Past orders keep working (they show "Product removed").
router.delete('/:id', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Product not found' })
    const product = await Product.findById(req.params.id).select('shop name').lean()
    if (!product) return res.status(404).json({ error: 'Product not found' })
    const shop = await Shop.findById(product.shop).select('owner').lean()
    if (!shop || String(shop.owner) !== String(req.body?.user)) {
      return res.status(403).json({ error: 'Only the shop owner can delete this product' })
    }

    await Product.deleteOne({ _id: product._id })
    await Shop.updateOne({ _id: product.shop }, { $pull: { pinnedProducts: product._id } })
    await Interaction.deleteMany({ product: product._id })
    // favourites are kept (the Favourites page hides deleted products) so the buyer can press
    // "Remove" on this notification to clear it from their favourites
    await notify(req, await favouritedBy(product._id), {
      type: 'favourite-unavailable',
      title: `${product.name} was removed by the seller`,
      message: 'An item in your favourites is no longer available.',
      product: product._id,
    })
    res.json({ deleted: req.params.id })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

export default router