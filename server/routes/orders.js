import express from 'express'
import Order from '../models/Order.js'
import Product from '../models/Product.js'
import Interaction from '../models/Interaction.js'
import { updateShopStats } from '../utils/trust.js'

// Owner: Basile
// POST /orders   GET /orders/buyer/:userId   GET /orders/shop/:shopId   PUT /orders/:id/status
const router = express.Router()

router.post('/', async (req, res) => {
  try {
    const { buyer, product, quantity, customisation, fulfilment, requestedTime } = req.body
    const p = await Product.findById(product)
    if (!p) return res.status(404).json({ message: 'Product not found' })

    const order = await Order.create({
      buyer,
      product,
      shop: p.shop,
      quantity,
      customisation,
      fulfilment,
      requestedTime,
      totalPrice: p.price * (quantity || 1),
    })
    await Interaction.create({ user: buyer, product, shop: p.shop, type: 'order' }) // feeds the FYP
    res.status(201).json(order)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

router.get('/buyer/:userId', async (req, res) => {
  try {
    const orders = await Order.find({ buyer: req.params.userId })
      .populate('product', 'name unit')
      .populate('shop', 'name')
      .sort({ createdAt: -1 })
    res.json(orders)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

router.get('/shop/:shopId', async (req, res) => {
  try {
    const orders = await Order.find({ shop: req.params.shopId })
      .populate('product', 'name unit')
      .populate('buyer', 'name')
      .sort({ createdAt: -1 })
    res.json(orders)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// body: { status, actor: 'buyer' | 'seller', proposedTime? }
router.put('/:id/status', async (req, res) => {
  try {
    const { status, actor, proposedTime } = req.body
    const order = await Order.findById(req.params.id)
    if (!order) return res.status(404).json({ message: 'Order not found' })

    if (status === 'accepted' && order.status === 'rescheduled') {
      // buyer agreed to the seller's new time
      order.requestedTime = order.proposedTime
      order.proposedTime = undefined
    } else if (status === 'rescheduled') {
      order.proposedTime = proposedTime
    }

    // first reply from the seller = response time (used by Yu Chen's trust score)
    if (['accepted', 'declined', 'rescheduled'].includes(status) && !order.respondedAt && actor === 'seller') {
      order.respondedAt = new Date()
    }
    if (status === 'cancelled') order.cancelledBy = actor

    order.status = status
    await order.save()
    await updateShopStats(order.shop) // keep seller stats up to date
    res.json(order)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// TODO (Basile): block invalid status changes (e.g. completed -> pending)
// TODO (Basile): check the requested time is one of the product's orderSlots

export default router
