import { OAuth2Client } from 'google-auth-library'
import { randomBytes } from 'crypto'
import User from '../models/User.js'
import Shop from '../models/Shop.js'
import Product from '../models/Product.js'

// Handles Google Calendar permission and events; logs fixed messages, never secrets.
const EVENTS_URL = 'https://www.googleapis.com/calendar/v3/calendars/primary/events'
const RETURN_PAGES = ['/seller/orders', '/orders', '/seller/calendar']
const SCOPES = ['openid', 'https://www.googleapis.com/auth/userinfo.email', 'https://www.googleapis.com/auth/calendar.events']

// Checks whether all three Calendar settings are present.
export function calendarEnabled() {
  if (!process.env.GOOGLE_CALENDAR_CLIENT_ID || !process.env.GOOGLE_CALENDAR_CLIENT_SECRET || !process.env.GOOGLE_CALENDAR_REDIRECT_URI) return false
  return true
}

// Builds a Google client, or returns null when Calendar is unavailable.
export function newClient() {
  if (!calendarEnabled()) return null
  try {
    return new OAuth2Client({
      clientId: process.env.GOOGLE_CALENDAR_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CALENDAR_CLIENT_SECRET,
      redirectUri: process.env.GOOGLE_CALENDAR_REDIRECT_URI,
    })
  } catch (err) {
    return null
  }
}

// Saves a ten-minute state and returns the Google consent link.
export async function startConnect(user, returnTo) {
  try {
    const client = newClient()
    if (!client || !user || !user.googleId) return '' // Only Google accounts may connect.
    let page = '/orders'
    if (user.role === 'seller') page = '/seller/orders'
    if (RETURN_PAGES.includes(returnTo)) page = returnTo
    if (!user.googleCalendar) user.googleCalendar = {}
    user.googleCalendar.state = randomBytes(32).toString('hex')
    user.googleCalendar.stateExpires = new Date(new Date().getTime() + 10 * 60 * 1000)
    user.googleCalendar.returnTo = page
    await user.save()
    return client.generateAuthUrl({ access_type: 'offline', prompt: 'consent', scope: SCOPES, state: user.googleCalendar.state })
  } catch (err) {
    return ''
  }
}

// Checks the saved state and Google account, then saves Calendar permission.
export async function finishConnect(code, state) {
  let returnTo = '/seller/orders'
  try {
    if (!calendarEnabled()) return { ok: false, returnTo, reason: 'failed' }
    if (typeof state !== 'string' || !state) return { ok: false, returnTo, reason: 'expired' }
    const user = await User.findOne({ 'googleCalendar.state': state }).select('+googleCalendar.state +googleCalendar.refreshToken')
    if (!user || !user.googleCalendar) return { ok: false, returnTo, reason: 'expired' }
    if (user.role !== 'seller') returnTo = '/orders'
    if (RETURN_PAGES.includes(user.googleCalendar.returnTo)) returnTo = user.googleCalendar.returnTo
    const validState = user.googleCalendar.stateExpires && new Date(user.googleCalendar.stateExpires).getTime() > new Date().getTime()
    user.googleCalendar.state = ''
    user.googleCalendar.stateExpires = null
    user.googleCalendar.returnTo = ''
    await user.save() // Clear the saved state before exchanging the code.
    if (!validState) return { ok: false, returnTo, reason: 'expired' }
    if (!user.googleId) return { ok: false, returnTo, reason: 'not-google-user' }
    const client = newClient()
    if (!client || typeof code !== 'string' || !code) return { ok: false, returnTo, reason: 'failed' }
    const response = await client.getToken(code)
    const tokens = response.tokens
    if (!tokens || !tokens.id_token) return { ok: false, returnTo, reason: 'failed' }
    const ticket = await client.verifyIdToken({ idToken: tokens.id_token, audience: process.env.GOOGLE_CALENDAR_CLIENT_ID })
    const payload = ticket.getPayload()
    if (!payload || !payload.sub || String(payload.sub) !== String(user.googleId)) return { ok: false, returnTo, reason: 'wrong-account' }
    if (tokens.refresh_token) user.googleCalendar.refreshToken = tokens.refresh_token
    if (!user.googleCalendar.refreshToken) return { ok: false, returnTo, reason: 'failed' }
    user.googleCalendar.email = payload.email || ''
    user.googleCalendar.connectedAt = new Date()
    await user.save()
    return { ok: true, returnTo, reason: '' }
  } catch (err) {
    return { ok: false, returnTo, reason: 'failed' }
  }
}

// Gets a fresh access token for server use, clearing permission if Google revoked it.
export async function accessTokenFor(userId) {
  let user = null
  try {
    const client = newClient()
    if (!client || !userId) return null
    user = await User.findById(userId).select('+googleCalendar.refreshToken')
    if (!user || !user.googleCalendar || !user.googleCalendar.connectedAt || !user.googleCalendar.refreshToken) return null
    client.setCredentials({ refresh_token: user.googleCalendar.refreshToken })
    const response = await client.getAccessToken()
    return response.token || null
  } catch (err) {
    if (user && err.response && err.response.data && err.response.data.error === 'invalid_grant') {
      try {
        user.googleCalendar = { refreshToken: '', email: '', connectedAt: null, state: '', stateExpires: null, returnTo: '' }
        await user.save()
      } catch (saveError) {
        return null
      }
    }
    return null
  }
}

// Adds an event tagged with details.orderId, or returns an empty id on failure.
export async function addEvent(userId, details) {
  try {
    if (!details || !details.orderId || !Number.isInteger(details.minutes) || details.minutes < 1) return ''
    const token = await accessTokenFor(userId)
    if (!token) return ''
    const start = new Date(details.start)
    const end = new Date(start.getTime() + details.minutes * 60 * 1000)
    const response = await fetch(EVENTS_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        summary: details.summary,
        description: details.description || '',
        location: details.location || '',
        start: { dateTime: start.toISOString(), timeZone: 'Asia/Singapore' },
        end: { dateTime: end.toISOString(), timeZone: 'Asia/Singapore' },
        extendedProperties: { private: { homlyOrderId: String(details.orderId) } },
      }),
    })
    if (!response.ok) {
      console.warn('Calendar: could not add an event.')
      return ''
    }
    const event = await response.json()
    return event.id || ''
  } catch (err) {
    console.warn('Calendar: could not add an event.')
    return ''
  }
}

// Deletes an event; an event that is already gone counts as deleted.
export async function deleteEvent(userId, eventId) {
  try {
    if (!eventId) return false
    const token = await accessTokenFor(userId)
    if (!token) return false
    const response = await fetch(`${EVENTS_URL}/${encodeURIComponent(eventId)}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
    return response.ok || response.status === 404 || response.status === 410
  } catch (err) {
    return false
  }
}

// Lists only the event fields the calendar page needs, or an empty list on failure.
export async function listEvents(userId, from, to) {
  try {
    const token = await accessTokenFor(userId)
    if (!token) return []
    const timeMin = encodeURIComponent(new Date(from).toISOString())
    const timeMax = encodeURIComponent(new Date(to).toISOString())
    const response = await fetch(`${EVENTS_URL}?timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&orderBy=startTime`, { headers: { Authorization: `Bearer ${token}` } })
    if (!response.ok) return []
    const data = await response.json()
    const items = data.items || []
    const events = []
    for (let i = 0; i < items.length; i++) {
      const event = items[i]
      if (!event.start || !event.end) continue // Google may omit times from an incomplete event.
      let ours = false
      if (event.extendedProperties && event.extendedProperties.private && event.extendedProperties.private.homlyOrderId) ours = true
      events.push({ id: event.id, title: event.summary || 'Busy', start: event.start.dateTime || event.start.date, end: event.end.dateTime || event.end.date, ours })
    }
    return events
  } catch (err) {
    return []
  }
}

// Revokes Google's permission when possible, then clears the local connection.
export async function disconnect(userId) {
  try {
    const user = await User.findById(userId).select('+googleCalendar.refreshToken')
    if (!user) return false
    const client = newClient()
    if (client && user.googleCalendar && user.googleCalendar.refreshToken) {
      try {
        await client.revokeToken(user.googleCalendar.refreshToken)
      } catch (err) {
        // Local disconnection still works when Google cannot be reached.
      }
    }
    user.googleCalendar = { refreshToken: '', email: '', connectedAt: null, state: '', stateExpires: null, returnTo: '' }
    await user.save()
    return true
  } catch (err) {
    return false
  }
}

// Returns safe connection information without loading or exposing a token.
export function calendarStatus(user) {
  const enabled = calendarEnabled()
  let connected = false
  let email = ''
  if (enabled && user && user.googleId && user.googleCalendar && user.googleCalendar.connectedAt) {
    connected = true
    email = user.googleCalendar.email || ''
  }
  return { enabled, connected, email, needsGoogleSignIn: !user || !user.googleId }
}

// Adds or removes each side's event after an order change, without failing the order.
export async function syncOrderCalendars(order, previousStatus) {
  const result = { seller: 'none', buyer: 'none' }
  const accepting = order.status === 'accepted' && ['pending', 'rescheduled'].includes(previousStatus)
  const cancelling = order.status === 'cancelled' && previousStatus === 'accepted'
  if (!accepting && !cancelling) return result
  const sides = [{ key: 'seller', field: 'sellerEventId' }, { key: 'buyer', field: 'buyerEventId' }]
  let changed = false
  for (let i = 0; i < sides.length; i++) {
    const side = sides[i]
    if (accepting && order[side.field]) continue // Do not add an event twice.
    if (cancelling && !order[side.field]) continue
    try {
      let shop = null
      if (accepting || side.key === 'seller') shop = await Shop.findById(order.shop)
      let userId = order.buyer
      if (side.key === 'seller') {
        if (!shop || !shop.owner) {
          result.seller = 'failed'
          continue
        }
        userId = shop.owner
      }
      if (accepting) {
        const user = await User.findById(userId)
        if (!calendarStatus(user).connected) {
          result[side.key] = 'not-connected'
          continue
        }
        const product = await Product.findById(order.product)
        let buyer = user
        if (side.key === 'seller') buyer = await User.findById(order.buyer)
        if (!shop || !product || !buyer) {
          result[side.key] = 'failed'
          continue
        }
        let kind = 'Pickup'
        let location = `${shop.address || ''} ${shop.postalCode || ''}`.trim()
        if (order.fulfilment === 'delivery') {
          kind = 'Delivery'
          location = `${order.deliveryAddress || ''} ${order.deliveryUnit || ''} ${order.deliveryPostalCode || ''}`.trim()
        }
        let otherName = shop.name
        if (side.key === 'seller') otherName = buyer.name
        let description = 'Homly Hauls order'
        if (order.customisation && order.customisation.trim()) description += `\n${order.customisation}`
        const eventId = await addEvent(userId, {
          orderId: order._id,
          summary: `${kind}: ${product.name} × ${order.quantity} (${otherName})`,
          description,
          location,
          start: order.requestedTime,
          minutes: 30,
        })
        if (!eventId) {
          result[side.key] = 'failed'
          continue
        }
        order[side.field] = eventId
        result[side.key] = 'added'
      } else {
        if (!await deleteEvent(userId, order[side.field])) {
          result[side.key] = 'failed'
          continue // Keep the id when Google could not delete its event.
        }
        order[side.field] = ''
        result[side.key] = 'removed'
      }
      changed = true
    } catch (err) {
      result[side.key] = 'failed'
    }
  }
  if (changed) {
    try {
      await order.save()
    } catch (err) {
      for (let i = 0; i < sides.length; i++) {
        const key = sides[i].key
        if (result[key] === 'added' || result[key] === 'removed') result[key] = 'failed'
      }
    }
  }
  return result
}
