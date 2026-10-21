import Notification from '../models/Notification.js'
import { emitFromRoute } from './realtime.js'

// Send a notification to one or more users, and tell their open browsers straight away
// (NotificationBell listens for 'notification' on the user's private Socket.IO room, see utils/realtime.js).
//   await notify(req, order.buyer, { type: 'order-update', title: '...', message: '...', link: '/orders' })
// Never throws: a failed notification must not break the order / review / product that caused it.
export async function notify(req, users, data) {
  try {
    const ids = [...new Set((Array.isArray(users) ? users : [users]).filter(Boolean).map(String))]
    if (ids.length === 0) return
    await Notification.insertMany(ids.map((user) => ({ ...data, user })))
    emitFromRoute(ids, 'notification')
  } catch (err) {
    console.error('Could not send notification:', err.message)
  }
}
