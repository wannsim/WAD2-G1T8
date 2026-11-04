import Order from '../models/Order.js'
import { notify } from './notify.js'

// "Overdue" reminder: an ACCEPTED order whose pickup / delivery time has passed (same rule as the
// order dashboard's red "Overdue" pill). The seller gets ONE notification per order time, telling them
// to mark it completed (or message the buyer). Checked every few minutes while the server runs.
//
// Several teammates run their own server on the same database, so each order is "claimed" with one
// atomic update (overdueRemindedFor = the time we reminded about) before notifying: only one server wins.
// If the order is moved to a new time later, it can be reminded again for that new time.
const CHECK_EVERY_MS = 5 * 60 * 1000 // every 5 minutes
const GRACE_MS = 30 * 60 * 1000 // wait 30 min after the time, so a pickup in progress isn't nagged
const BATCH = 50

// order-time label in Singapore time, e.g. "3 Nov, 10:30 am"
const timeLabel = (d) => new Date(d).toLocaleString('en-SG', {
  day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Singapore',
})

// overdue + not yet reminded about THIS time
const notRemindedYet = { $expr: { $ne: ['$overdueRemindedFor', '$requestedTime'] } }

async function checkOverdueOrders() {
  try {
    const cutoff = new Date(Date.now() - GRACE_MS)
    const due = await Order.find({ status: 'accepted', requestedTime: { $lte: cutoff }, ...notRemindedYet })
      .select('_id requestedTime')
      .limit(BATCH)
      .lean()

    for (const { _id, requestedTime } of due) {
      // claim it: only the server whose update succeeds sends the reminder
      const order = await Order.findOneAndUpdate(
        { _id, status: 'accepted', requestedTime, ...notRemindedYet },
        { $set: { overdueRemindedFor: requestedTime } },
        { new: true },
      ).populate('shop', 'owner').populate('product', 'name').populate('buyer', 'name')
      if (!order?.shop?.owner) continue

      const what = order.product?.name || 'An order'
      const who = order.buyer?.name ? ` for ${order.buyer.name}` : ''
      const kind = order.fulfilment === 'delivery' ? 'delivery' : 'pickup'
      await notify(null, order.shop.owner, {
        type: 'overdue-reminder',
        title: 'Overdue order: mark it completed?',
        message: `${what}${who} was due for ${kind} on ${timeLabel(order.requestedTime)}. If it's done, mark it completed; if not, message the buyer.`,
        link: '/seller/orders',
      })
    }
  } catch (err) {
    console.error('Overdue reminders failed:', err.message)
  }
}

export function startOverdueReminders() {
  checkOverdueOrders()
  setInterval(checkOverdueOrders, CHECK_EVERY_MS)
}
