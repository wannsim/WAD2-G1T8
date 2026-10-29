import express from 'express'
import Order from '../models/Order.js'
import Product from '../models/Product.js'
import Shop from '../models/Shop.js'
import Interaction from '../models/Interaction.js'
import Review from '../models/Review.js'
import User from '../models/User.js'
import { updateShopStats } from '../utils/trust.js'
import { notify } from '../utils/notify.js'
import { formatDateTime } from '../utils/format.js'

// what the buyer is told when the seller changes their order
const BUYER_UPDATE = {
  accepted: (product, shop) => ({ title: 'Order accepted', message: `${shop} accepted your order for ${product}.` }),
  declined: (product, shop, order) => ({ title: 'Order declined', message: `${shop} declined your order for ${product}. Reason: ${order.reason}` }),
  rescheduled: (product, shop, order) => ({
    title: 'New time proposed',
    message: `${shop} proposed ${formatDateTime(order.proposedTime)} for ${product}. Please accept or cancel.`,
  }),
  completed: (product, shop) => ({ title: 'Order completed', message: `Your order for ${product} from ${shop} is completed.` }),
  cancelled: (product, shop, order) => ({ title: 'Order cancelled', message: `${shop} cancelled your order for ${product}. Reason: ${order.reason}` }),
}

// declining / cancelling needs a short reason, shown to the other side
const NEEDS_REASON = ['declined', 'cancelled']
const MAX_REASON_LENGTH = 300

// Owner: Basile
// POST /orders   GET /orders/open-slots/:productId   GET /orders/buyer/:userId   GET /orders/shop/:shopId   PUT /orders/:id/status
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
// noOpenSlots: every slot has passed or is full -> delivery may ask for any future time (pickup still needs a slot).
function checkNewOrder(body, product, shop, noOpenSlots) {
  if (!body.buyer) return 'Please log in again.' // An order needs a buyer.
  if (product.isAvailable === false) return 'This product is not available right now.' // Only available products may be ordered.
  if (!Number.isInteger(body.quantity) || body.quantity < 1) return 'Quantity must be a whole number, 1 or more.' // Quantity must be a positive whole number.
  if (body.fulfilment !== 'pickup' && body.fulfilment !== 'delivery') return 'Choose pickup or delivery.' // Keep both fulfilment options.
  if (body.fulfilment === 'pickup' && shop.pickup === false) return 'This shop does not offer that option.' // Pickup must be offered by the shop.
  if (body.fulfilment === 'delivery' && shop.delivery === false) return 'This shop does not offer that option.' // Delivery must be offered by the shop.
  if (body.fulfilment === 'delivery') {
    if (!String(body.deliveryAddress || '').trim()) return 'Please enter the delivery address.' // Delivery needs somewhere to go.
    if (!/^\d{6}$/.test(String(body.deliveryPostalCode || '').trim())) return 'Postal code must be 6 digits.' // Singapore postal codes are 6 digits.
    if (String(body.deliveryAddress).length > 200 || String(body.deliveryUnit || '').length > 30) return 'The address is too long.'
  }
  if (body.customisation && body.customisation.length > 200) return 'Keep your note under 200 characters.' // Limit the buyer's customisation note.
  if (!body.requestedTime) return 'Please choose a pickup time.' // An order needs a time.
  if (noOpenSlots) {
    if (body.fulfilment !== 'delivery') return 'There are no pickup slots left. Choose delivery and suggest a time.'
    const time = new Date(body.requestedTime).getTime()
    if (!Number.isFinite(time)) return 'Please choose a valid delivery time.'
    if (time < startOfTomorrowSingapore()) return 'Please choose a delivery date from tomorrow onwards.' // The seller needs a day's notice.
    if (time > Date.now() + MAX_REQUEST_AHEAD_MS) return 'Please choose a time within the next 6 months.'
    return ''
  }
  const slot = findSlot(product, body.requestedTime)
  if (!slot) return 'That time is not one of the seller\'s slots.' // Use one of the product's slots.
  if (!(new Date().getTime() < new Date(slot.start).getTime())) return 'That time has already passed.' // The slot must start in the future.
  return ''
}

const MAX_REQUEST_AHEAD_MS = 183 * 24 * 60 * 60 * 1000 // about 6 months
const DAY_MS = 24 * 60 * 60 * 1000
const SINGAPORE_OFFSET_MS = 8 * 60 * 60 * 1000

// midnight at the start of tomorrow, Singapore time (as a timestamp)
function startOfTomorrowSingapore() {
  const singaporeNow = Date.now() + SINGAPORE_OFFSET_MS
  return Math.floor(singaporeNow / DAY_MS) * DAY_MS + DAY_MS - SINGAPORE_OFFSET_MS
}

// The product's slots that can still be booked: in the future and not full.
async function openSlotsOf(product) {
  const now = Date.now()
  const open = []
  for (const slot of product.orderSlots || []) {
    if (new Date(slot.start).getTime() <= now) continue
    const capacity = slot.capacity ?? 10 // Same default as Product.js
    if ((await countSlotOrders(product._id, slot.start)) < capacity) open.push(slot)
  }
  return open
}
const hasNoOpenSlots = async (product) => (await openSlotsOf(product)).length === 0

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
    deliveryAddress: order.deliveryAddress || '',
    deliveryUnit: order.deliveryUnit || '',
    deliveryPostalCode: order.deliveryPostalCode || '',
    requestedTime: order.requestedTime,
    proposedTime: order.proposedTime,
    totalPrice: order.totalPrice,
    status: order.status,
    reviewed: reviewedIds.includes(String(order._id)), // Show whether this order has a review.
    cancelledBy: order.cancelledBy,
    reason: order.reason || '',
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

// The slots a buyer can still pick for a product (future and not full), for the order page.
// GET /orders/open-slots/:productId -> [{ _id, start, capacity }]
router.get('/open-slots/:productId', async (req, res) => {
  try {
    const p = await Product.findById(req.params.productId).select('orderSlots')
    if (!p) return res.status(404).json({ message: 'Product not found' })
    res.json(await openSlotsOf(p))
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// Creates an order after checking its fields and slot capacity. Repeat orders are allowed.
router.post('/', async (req, res) => {
  try {
    const { buyer, product, quantity, customisation, fulfilment, requestedTime, saveAddress } = req.body
    if (!product) return res.status(400).json({ message: 'No product chosen.' }) // An order needs a product.
    const p = await Product.findById(product)
    if (!p) return res.status(404).json({ message: 'Product not found' })
    const shop = await Shop.findById(p.shop)
    if (!shop) return res.status(404).json({ message: 'Shop not found' })
    if (String(shop.owner) === String(buyer)) return res.status(403).json({ message: 'You cannot order from your own shop.' }) // Sellers cannot buy their own products.

    const noOpenSlots = await hasNoOpenSlots(p)
    const message = checkNewOrder(req.body, p, shop, noOpenSlots)
    if (message) return res.status(400).json({ message }) // Reject invalid order fields.

    if (!noOpenSlots) { // A delivery time the buyer suggested (no slots left) uses no slot place.
      const slot = findSlot(p, requestedTime)
      const used = await countSlotOrders(product, requestedTime)
      let capacity = slot.capacity
      if (capacity === undefined || capacity === null) capacity = 10 // Same default as Product.js when capacity is missing or empty.
      if (used >= capacity) return res.status(409).json({ message: 'That time slot is full. Please pick another.' }) // Count orders, not quantity.
    }

    let customisationNote = customisation
    if (p.customisable === false) customisationNote = '' // Non-customisable products get no note.

    // pickup orders keep no address; delivery orders keep their own copy
    const delivery = { deliveryAddress: '', deliveryUnit: '', deliveryPostalCode: '' }
    if (fulfilment === 'delivery') {
      delivery.deliveryAddress = String(req.body.deliveryAddress).trim()
      delivery.deliveryUnit = String(req.body.deliveryUnit || '').trim()
      delivery.deliveryPostalCode = String(req.body.deliveryPostalCode).trim()
    }

    const order = await Order.create({
      buyer,
      product,
      shop: p.shop,
      quantity,
      customisation: customisationNote,
      fulfilment,
      ...delivery,
      requestedTime,
      totalPrice: p.price * quantity,
    })
    if (fulfilment === 'delivery' && saveAddress) await User.updateOne({ _id: buyer }, delivery) // "Save as my default address"
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
// body: { status, userId, proposedTime, reason }   reason: required when declining / cancelling
router.put('/:id/status', async (req, res) => {
  try {
    const { status, userId, proposedTime } = req.body
    const reason = String(req.body.reason ?? '').trim()
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

    if (NEEDS_REASON.includes(status)) {
      if (!reason) return res.status(400).json({ message: 'Please give a reason.' })
      if (reason.length > MAX_REASON_LENGTH) {
        return res.status(400).json({ message: `Please keep the reason under ${MAX_REASON_LENGTH} characters.` })
      }
    }

    if (status === 'rescheduled') {
      const now = new Date().getTime()
      const newTime = new Date(proposedTime).getTime()
      if (!proposedTime || !(now < newTime)) { // The proposed time must be present and in the future.
        return res.status(400).json({ message: 'Please choose a new time in the future.' })
      }
    }

    // A time that has already passed cannot be accepted.
    if (status === 'accepted') {
      let acceptedTime = order.requestedTime
      if (order.status === 'rescheduled') acceptedTime = order.proposedTime // The buyer is accepting the seller's new time.
      if (!(new Date().getTime() < new Date(acceptedTime).getTime())) { // The time must still be in the future.
        let message = 'This pickup time has passed. Propose a new time instead.'
        if (actor === 'buyer') message = 'This new time has passed. Message the seller for another time.'
        return res.status(400).json({ message })
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
    if (NEEDS_REASON.includes(status)) order.reason = reason

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
              message: `The buyer cancelled their order for ${productName} (${formatDateTime(order.requestedTime)}). Reason: ${order.reason}`,
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
    // Also tells the person who declined / cancelled, so both sides have it in their notifications.
    if (NEEDS_REASON.includes(status)) {
      try {
        const product = await Product.findById(order.product).select('name')
        const productName = product?.name || 'an item'
        const action = status === 'declined' ? 'declined' : 'cancelled'
        let userToTell = order.buyer
        let link = '/orders'
        let whose = 'your order'
        if (actor === 'seller') {
          const shop = await Shop.findById(order.shop).select('owner')
          const buyer = await User.findById(order.buyer).select('name')
          userToTell = shop?.owner
          link = '/seller/orders'
          whose = `${buyer?.name || 'the buyer'}'s order`
        }
        await notify(req, userToTell, {
          type: 'order-update',
          title: `Order ${action}`,
          message: `You ${action} ${whose} for ${productName}. Reason: ${order.reason}`,
          link,
        })
      } catch (err) {
        console.error('Could not send the confirmation notification:', err.message)
      }
    }
    res.json(order)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

export default router
