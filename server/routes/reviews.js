import mongoose from 'mongoose'
import express from 'express'
import Review from '../models/Review.js'
import Order from '../models/Order.js'
import { updateShopStats } from '../utils/trust.js'
import Shop from '../models/Shop.js'
import Product from '../models/Product.js'
import { notify } from '../utils/notify.js'

// Owner: Yu Chen
// POST /reviews   GET /reviews/shop/:shopId   GET /reviews/product/:productId
const router = express.Router()

// body: { order, buyer, rating, comment }
router.post('/', async (req, res) => {
  try {
    const { order: orderId, buyer, rating, comment } = req.body
    const order = await Order.findById(orderId)
    if (!order) return res.status(404).json({ message: 'Order not found' })
    if (String(order.buyer) !== String(buyer)) return res.status(403).json({ message: 'This is not your order' })
    if (order.status !== 'completed') return res.status(400).json({ message: 'You can only review completed orders' })

    const already = await Review.findOne({ order: orderId })
    if (already) return res.status(409).json({ message: 'You already reviewed this order' })

    const review = await Review.create({
      order: orderId,
      buyer,
      shop: order.shop,
      product: order.product,
      rating,
      comment,
    })
    await updateShopStats(order.shop) // recalculates rating + trust score

    // tell the seller; the link opens My Shop's reviews section filtered to this product
    const [shop, product] = await Promise.all([
      Shop.findById(order.shop).select('owner').lean(),
      Product.findById(order.product).select('name').lean(),
    ])
    await notify(req, shop?.owner, {
      type: 'new-review',
      title: `New ${rating}-star review`,
      message: `${product?.name || 'A product'}${comment ? `: "${comment.slice(0, 80)}${comment.length > 80 ? '...' : ''}"` : ''}`,
      link: `/seller/shop?review=${order.product}#product-reviews`,
      product: order.product,
    })
    res.status(201).json(review)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// every review of one product, newest first (the product page's "Product ratings")
router.get('/product/:productId', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.productId)) return res.json([])
    const reviews = await Review.find({ product: req.params.productId })
      .select('buyer rating comment createdAt')
      .populate('buyer', 'name')
      .sort({ createdAt: -1 })
    res.json(reviews)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

router.get('/shop/:shopId', async (req, res) => {
  try {
    const reviews = await Review.find({ shop: req.params.shopId })
      .populate('buyer', 'name')
      .populate('product', 'name')
      .sort({ createdAt: -1 })
    res.json(reviews)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

export default router
