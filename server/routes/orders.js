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

// Finds the product's slot that starts at the requested time.
function findSlot(product, requestedTime) {
  const requestedTimeNumber = new Date(requestedTime).getTime()
  for (let i = 0; i < product.orderSlots.length; i++) {
    const slot = product.orderSlots[i]
    if (new Date(slot.start).getTime() === requestedTimeNumber) return slot // R7: the requested time must match a slot.
  }
  return null
}

// Returns the first problem with a new order, or an empty string if it is valid.
function checkNewOrder(body, product, shop) {
  if (!body.buyer) return 'Please log in again.' // R8: an order needs a buyer.
  if (product.isAvailable === false) return 'This product is not available right now.' // CARD 5b: only available products may be ordered.
  if (!Number.isInteger(body.quantity) || body.quantity < 1) return 'Quantity must be a whole number, 1 or more.' // R6: quantity must be a positive whole number.
  if (body.fulfilment !== 'pickup' && body.fulfilment !== 'delivery') return 'Choose pickup or delivery.' // OPEN #8: keep both fulfilment options.
  if (body.fulfilment === 'pickup' && shop.pickup === false) return 'This shop does not offer that option.' // OPEN #8: pickup must be offered by the shop.
  if (body.fulfilment === 'delivery' && shop.delivery === false) return 'This shop does not offer that option.' // OPEN #8: delivery must be offered by the shop.
  if (body.customisation && body.customisation.length > 200) return 'Keep your note under 200 characters.' // CARD 5f: limit the buyer's customisation note.
  if (!body.requestedTime) return 'Please choose a pickup time.' // R8: an order needs a time.
  const slot = findSlot(product, body.requestedTime)
  if (!slot) return 'That time is not one of the seller\'s slots.' // R7: use one of the product's slots.
  if (!(new Date().getTime() < new Date(slot.start).getTime())) return 'That time has already passed.' // R7: the slot must start in the future.
  return ''
}

// Counts orders that use a place in this product's requested slot.
async function countSlotOrders(productId, requestedTime) {
  const orders = await Order.find({ product: productId })
  const requestedTimeNumber = new Date(requestedTime).getTime()
  const countedStatuses = ['pending', 'accepted', 'rescheduled', 'completed']
  let count = 0
  for (let i = 0; i < orders.length; i++) {
    const order = orders[i]
    if (new Date(order.requestedTime).getTime() === requestedTimeNumber && countedStatuses.includes(order.status)) { // R6: count only matching orders that use the slot.
      count++
    }
  }
  return count
}

// Builds a buyer's order response with pickup details only when allowed.
function safeOrderForBuyer(order) {
  const safeOrder = {
    _id: order._id,
    product: order.product,
    quantity: order.quantity,
    customisation: order.customisation,
    fulfilment: order.fulfilment,
    requestedTime: order.requestedTime,
    proposedTime: order.proposedTime,
    totalPrice: order.totalPrice,
    status: order.status,
    cancelledBy: order.cancelledBy,
    createdAt: order.createdAt,
    shop: null,
    pickupAddress: '',
    pickupPostalCode: '',
  }
  if (order.shop) {
    safeOrder.shop = {
      _id: order.shop._id,
      name: order.shop.name,
      nearestMrt: order.shop.nearestMrt,
    }
  }
  if (order.shop && order.fulfilment === 'pickup' && (order.status === 'accepted' || order.status === 'completed')) { // R4: pickup details need an accepted or completed pickup order.
    if (order.shop.address) safeOrder.pickupAddress = order.shop.address // R4: copy the address only after the privacy check.
    if (order.shop.postalCode) safeOrder.pickupPostalCode = order.shop.postalCode // R4: copy the postal code only after the privacy check.
  }
  return safeOrder
}

// Creates an order after checking its fields, repeats and slot capacity.
router.post('/', async (req, res) => {
  try {
    const { buyer, product, quantity, customisation, fulfilment, requestedTime } = req.body
    if (!product) return res.status(400).json({ message: 'No product chosen.' }) // R8: an order needs a product.
    const p = await Product.findById(product)
    if (!p) return res.status(404).json({ message: 'Product not found' })
    const shop = await Shop.findById(p.shop)
    if (!shop) return res.status(404).json({ message: 'Shop not found' })

    const message = checkNewOrder(req.body, p, shop)
    if (message) return res.status(400).json({ message }) // R6, R7, R8: reject invalid order fields.

    const already = await Order.findOne({ buyer, product, requestedTime, status: 'pending' })
    if (already) return res.status(409).json({ message: 'You already sent this request.' }) // R11: reject the same pending request.

    const slot = findSlot(p, requestedTime)
    const used = await countSlotOrders(product, requestedTime)
    let capacity = slot.capacity
    if (capacity === undefined) capacity = 1 // R6: match Product.js's default when capacity is missing.
    if (used >= capacity) return res.status(409).json({ message: 'That time slot is full. Please pick another.' }) // R6: count orders, not quantity, under OPEN #4.

    let customisationNote = customisation
    if (p.customisable === false) customisationNote = '' // R1: non-customisable products get no note.

    const order = await Order.create({
      buyer,
      product,
      shop: p.shop,
      quantity,
      customisation: customisationNote,
      fulfilment,
      requestedTime,
      totalPrice: p.price * quantity,
    })
    await Interaction.create({ user: buyer, product, shop: p.shop, type: 'order' }) // feeds the FYP
    res.status(201).json(order)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// Sends the buyer's orders with the pickup-address privacy rule applied.
router.get('/buyer/:userId', async (req, res) => {
  try {
    const orders = await Order.find({ buyer: req.params.userId })
      .populate('product', 'name unit')
      .populate('shop', 'name nearestMrt address postalCode')
      .sort({ createdAt: -1 })
    const safeOrders = []
    for (let i = 0; i < orders.length; i++) {
      safeOrders.push(safeOrderForBuyer(orders[i])) // R4: send only the hand-picked buyer response.
    }
    res.json(safeOrders)
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

// Applies an allowed status change for the order's buyer or seller.
// body: { status, userId, proposedTime }
router.put('/:id/status', async (req, res) => {
  try {
    const { status, userId, proposedTime } = req.body
    const order = await Order.findById(req.params.id)
    if (!order) return res.status(404).json({ message: 'Order not found' })

    const actor = await findActor(order, userId)
    if (!actor) return res.status(403).json({ message: 'This is not your order' }) // R10: only the buyer or shop owner may act.

    if (status === order.status) { // R11: reject a repeat of the saved status.
      return res.status(409).json({ message: `This order is already ${status}.` })
    }
    if (!isAllowedChange(order.status, actor, status)) { // R9: follow the status table for this person.
      return res.status(400).json({ message: `You cannot change this order from ${order.status} to ${status}.` })
    }

    if (status === 'rescheduled') {
      const now = new Date().getTime()
      const newTime = new Date(proposedTime).getTime()
      if (!proposedTime || !(now < newTime)) { // R7: the proposed time must be present and in the future.
        return res.status(400).json({ message: 'Please choose a new time in the future.' })
      }
    }

    if (status === 'accepted' && order.status === 'rescheduled') { // R5: use the time the buyer agreed to.
      // buyer agreed to the seller's new time
      order.requestedTime = order.proposedTime
      order.proposedTime = undefined
    } else if (status === 'rescheduled') {
      order.proposedTime = proposedTime
    }

    // first reply from the seller = response time (used by Yu Chen's trust score)
    if (['accepted', 'declined', 'rescheduled'].includes(status) && !order.respondedAt && actor === 'seller') { // R5: record only the first seller reply.
      order.respondedAt = new Date()
    }
    if (status === 'cancelled') order.cancelledBy = actor // R5: record who cancelled using the checked actor.

    order.status = status
    await order.save()
    await updateShopStats(order.shop) // keep seller stats up to date
    res.json(order)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

export default router
