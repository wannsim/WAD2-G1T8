import express from 'express'
import Order from '../models/Order.js'
import Product from '../models/Product.js'
import Shop from '../models/Shop.js'
import Interaction from '../models/Interaction.js'
import Review from '../models/Review.js'
import { updateShopStats } from '../utils/trust.js'
import { notify } from '../utils/notify.js'
import { formatDateTime } from '../utils/format.js'

// what the buyer is told when the seller changes their order
const BUYER_UPDATE = {
  accepted: (product, shop) => ({ title: 'Order accepted', message: `${shop} accepted your order for ${product}.` }),
  declined: (product, shop) => ({ title: 'Order declined', message: `${shop} declined your order for ${product}.` }),
  rescheduled: (product, shop, order) => ({
    title: 'New time proposed',
    message: `${shop} proposed ${formatDateTime(order.proposedTime)} for ${product}. Please accept or cancel.`,
  }),
  completed: (product, shop) => ({ title: 'Order completed', message: `Your order for ${product} from ${shop} is completed.` }),
  cancelled: (product, shop) => ({ title: 'Order cancelled', message: `${shop} cancelled your order for ${product}.` }),
}

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
  if (actor !== 'buyer' && actor !== 'seller') return false // Only buyer and seller have status rules.
  const rules = NEXT_STATUS[currentStatus]
  if (!rules || !rules[actor]) return false // Reject statuses with no rules for this person.
  return rules[actor].includes(newStatus) // The new status must be in the allowed list.
}

// Finds whether this user is the order's buyer or the shop's owner.
async function findActor(order, userId) {
  if (!userId) return '' // A user id is needed to check ownership.
  if (String(order.buyer) === String(userId)) return 'buyer' // Match the order's buyer.
  const shop = await Shop.findById(order.shop)
  if (shop && String(shop.owner) === String(userId)) return 'seller' // Match the shop's owner if the shop exists.
  return ''
}

// Finds the product's slot that starts at the requested time.
function findSlot(product, requestedTime) {
  const requestedTimeNumber = new Date(requestedTime).getTime()
  for (let i = 0; i < product.orderSlots.length; i++) {
    const slot = product.orderSlots[i]
    if (new Date(slot.start).getTime() === requestedTimeNumber) return slot // The requested time must match a slot.
  }
  return null
}

// Returns the first problem with a new order, or an empty string if it is valid.
function checkNewOrder(body, product, shop) {
  if (!body.buyer) return 'Please log in again.' // An order needs a buyer.
  if (product.isAvailable === false) return 'This product is not available right now.' // Only available products may be ordered.
  if (!Number.isInteger(body.quantity) || body.quantity < 1) return 'Quantity must be a whole number, 1 or more.' // Quantity must be a positive whole number.
  if (body.fulfilment !== 'pickup' && body.fulfilment !== 'delivery') return 'Choose pickup or delivery.' // Keep both fulfilment options.
  if (body.fulfilment === 'pickup' && shop.pickup === false) return 'This shop does not offer that option.' // Pickup must be offered by the shop.
  if (body.fulfilment === 'delivery' && shop.delivery === false) return 'This shop does not offer that option.' // Delivery must be offered by the shop.
  if (body.customisation && body.customisation.length > 200) return 'Keep your note under 200 characters.' // Limit the buyer's customisation note.
  if (!body.requestedTime) return 'Please choose a pickup time.' // An order needs a time.
  const slot = findSlot(product, body.requestedTime)
  if (!slot) return 'That time is not one of the seller\'s slots.' // Use one of the product's slots.
  if (!(new Date().getTime() < new Date(slot.start).getTime())) return 'That time has already passed.' // The slot must start in the future.
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
    if (new Date(order.requestedTime).getTime() === requestedTimeNumber && countedStatuses.includes(order.status)) { // Count only matching orders that use the slot.
      count++
    }
  }
  return count
}

// Builds a buyer's order response with review status and pickup details only when allowed.
function safeOrderForBuyer(order, reviewedIds) {
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
    reviewed: reviewedIds.includes(String(order._id)), // Show whether this order has a review.
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
  if (order.shop && order.fulfilment === 'pickup' && (order.status === 'accepted' || order.status === 'completed')) { // Pickup details need an accepted or completed pickup order.
    if (order.shop.address) safeOrder.pickupAddress = order.shop.address // Copy the address only after the privacy check.
    if (order.shop.postalCode) safeOrder.pickupPostalCode = order.shop.postalCode // Copy the postal code only after the privacy check.
  }
  return safeOrder
}

// Creates an order after checking its fields and slot capacity. Repeat orders are allowed.
router.post('/', async (req, res) => {
  try {
    const { buyer, product, quantity, customisation, fulfilment, requestedTime } = req.body
    if (!product) return res.status(400).json({ message: 'No product chosen.' }) // An order needs a product.
    const p = await Product.findById(product)
    if (!p) return res.status(404).json({ message: 'Product not found' })
    const shop = await Shop.findById(p.shop)
    if (!shop) return res.status(404).json({ message: 'Shop not found' })

    const message = checkNewOrder(req.body, p, shop)
    if (message) return res.status(400).json({ message }) // Reject invalid order fields.

    const slot = findSlot(p, requestedTime)
    const used = await countSlotOrders(product, requestedTime)
    let capacity = slot.capacity
    if (capacity === undefined) capacity = 10 // Same default as Product.js when capacity is missing.
    if (used >= capacity) return res.status(409).json({ message: 'That time slot is full. Please pick another.' }) // Count orders, not quantity.

    let customisationNote = customisation
    if (p.customisable === false) customisationNote = '' // Non-customisable products get no note.

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
    await notify(req, shop.owner, {
      type: 'new-order',
      title: 'New order',
      message: `${quantity} x ${p.name} for ${formatDateTime(requestedTime)}`,
      link: '/seller/orders',
    })
    res.status(201).json(order)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// Sends the buyer's orders with review status and the pickup-address privacy rule applied.
router.get('/buyer/:userId', async (req, res) => {
  try {
    const orders = await Order.find({ buyer: req.params.userId })
      .populate('product', 'name unit')
      .populate('shop', 'name nearestMrt address postalCode')
      .sort({ createdAt: -1 })
    const reviews = await Review.find({ buyer: req.params.userId })
    const reviewedIds = []
    for (let i = 0; i < reviews.length; i++) {
      const review = reviews[i]
      reviewedIds.push(String(review.order))
    }
    const safeOrders = []
    for (let i = 0; i < orders.length; i++) {
      safeOrders.push(safeOrderForBuyer(orders[i], reviewedIds)) // Send only the hand-picked buyer response.
    }
    res.json(safeOrders)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// Returns shop orders soonest pickup first so the seller can handle earlier pickups first.
router.get('/shop/:shopId', async (req, res) => {
  try {
    const orders = await Order.find({ shop: req.params.shopId })
      .populate('product', 'name unit')
      .populate('buyer', 'name')
      .sort({ requestedTime: 1 })
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
    if (!actor) return res.status(403).json({ message: 'This is not your order' }) // Only the buyer or shop owner may act.

    if (status === order.status) { // Reject a repeat of the saved status.
      return res.status(409).json({ message: `This order is already ${status}.` })
    }
    if (!isAllowedChange(order.status, actor, status)) { // Follow the status table for this person.
      return res.status(400).json({ message: `You cannot change this order from ${order.status} to ${status}.` })
    }

    if (status === 'rescheduled') {
      const now = new Date().getTime()
      const newTime = new Date(proposedTime).getTime()
      if (!proposedTime || !(now < newTime)) { // The proposed time must be present and in the future.
        return res.status(400).json({ message: 'Please choose a new time in the future.' })
      }
    }

    if (status === 'accepted' && order.status === 'rescheduled') { // Use the time the buyer agreed to.
      // buyer agreed to the seller's new time
      order.requestedTime = order.proposedTime
      order.proposedTime = undefined
    } else if (status === 'rescheduled') {
      order.proposedTime = proposedTime
    }

    // first reply from the seller = response time (used by Yu Chen's trust score)
    if (['accepted', 'declined', 'rescheduled'].includes(status) && !order.respondedAt && actor === 'seller') { // Record only the first seller reply.
      order.respondedAt = new Date()
    }
    if (status === 'cancelled') order.cancelledBy = actor // Record who cancelled using the checked actor.

    order.status = status
    await order.save()
    await updateShopStats(order.shop) // keep seller stats up to date

    if (actor === 'seller') {
      // tell the buyer; when completed, also remind them they can leave a review
      await order.populate([{ path: 'product', select: 'name' }, { path: 'shop', select: 'name' }])
      const productName = order.product?.name || 'your item'
      const shopName = order.shop?.name || 'The seller'
      await notify(req, order.buyer, { type: 'order-update', link: '/orders', ...BUYER_UPDATE[status](productName, shopName, order) })
      if (status === 'completed') {
        await notify(req, order.buyer, {
          type: 'review-reminder',
          title: 'Leave a review?',
          message: `How was ${productName}? You can now review your order (optional).`,
          link: `/review/${order._id}`,
          product: order.product?._id,
        })
      }
      order.depopulate()
    }

    // Tells the seller when the buyer cancels or accepts a new time.
    if (actor === 'buyer' && (status === 'cancelled' || status === 'accepted')) {
      try {
        const shop = await Shop.findById(order.shop)
        const product = await Product.findById(order.product).select('name')
        let productName = 'an item'
        if (product) productName = product.name
        if (shop) {
          if (status === 'cancelled') {
            await notify(req, shop.owner, {
              type: 'order-update',
              title: 'Order cancelled',
              message: `The buyer cancelled their order for ${productName} (${formatDateTime(order.requestedTime)}).`,
              link: '/seller/orders',
            })
          } else {
            await notify(req, shop.owner, {
              type: 'order-update',
              title: 'New time accepted',
              message: `The buyer accepted your new time for ${productName}: ${formatDateTime(order.requestedTime)}.`,
              link: '/seller/orders',
            })
          }
        }
      } catch (err) {
        console.error('Could not notify the seller:', err.message)
      }
    }
    res.json(order)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

export default router
