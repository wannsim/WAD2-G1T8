import express from 'express'
import Order from '../models/Order.js'
import Product from '../models/Product.js'
import Shop from '../models/Shop.js'
import Interaction from '../models/Interaction.js'
import { updateShopStats } from '../utils/trust.js'

// Owner: Basile
// POST /orders   GET /orders/buyer/:userId   GET /orders/shop/:shopId   PUT /orders/:id/status
const router = express.Router()

const NEXT_STATUS = {
  pending: {
    seller: ['accepted', 'declined', 'rescheduled'],
    buyer: ['cancelled'],
  },
  rescheduled: {
    seller: [],
    buyer: ['accepted', 'cancelled'],
  },
  accepted: {
    seller: ['completed', 'cancelled'],
    buyer: ['cancelled'],
  },
  declined: {
    seller: [],
    buyer: [],
  },
  completed: {
    seller: [],
    buyer: [],
  },
  cancelled: {
    seller: [],
    buyer: [],
  },
}

// Checks whether this person may change the current status to the new status.
function isAllowedChange(currentStatus, actor, newStatus) {
  if (actor !== 'buyer' && actor !== 'seller') return false // R9: only buyer and seller have status rules.
  const rules = NEXT_STATUS[currentStatus]
  if (!rules || !rules[actor]) return false // R9: reject statuses with no rules for this person.
  return rules[actor].includes(newStatus) // R9: the new status must be in the allowed list.
}

// Finds whether this user is the order's buyer or the shop's owner.
async function findActor(order, userId) {
  if (!userId) return '' // R10: a user id is needed to check ownership.
  if (String(order.buyer) === String(userId)) return 'buyer' // R10: match the order's buyer.
  const shop = await Shop.findById(order.shop)
  if (shop && String(shop.owner) === String(userId)) return 'seller' // R10: match the shop's owner if the shop exists.
  return ''
}

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
