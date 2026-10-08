import express from 'express'
import Review from '../models/Review.js'
import Order from '../models/Order.js'
import { updateShopStats } from '../utils/trust.js'

// Owner: Yu Chen
// POST /reviews   GET /reviews/shop/:shopId
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
    res.status(201).json(review)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

router.get('/shop/:shopId', async (req, res) => {
  try {
    const reviews = await Review.find({ shop: req.params.shopId })
      .populate('buyer', 'name')
      .sort({ createdAt: -1 })
    res.json(reviews)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

export default router
