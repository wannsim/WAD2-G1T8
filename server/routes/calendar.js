import express from 'express'
import bcrypt from 'bcryptjs'
import User from '../models/User.js'
import { calendarEnabled, startConnect, finishConnect, calendarStatus, disconnect, listEvents } from '../utils/googleCalendar.js'

const router = express.Router()
const RETURN_PAGES = ['/seller/orders', '/orders', '/seller/calendar']

// Keeps return links on a known page, falling back to this person's orders.
function allowedReturnTo(page, role = 'seller') {
  if (RETURN_PAGES.includes(page)) return page
  if (role === 'seller') return '/seller/orders'
  return '/orders'
}

// POST /calendar/connect-start checks Homly ownership before returning Google's consent link.
router.post('/connect-start', async (req, res) => {
  try {
    if (!calendarEnabled()) return res.status(400).json({ message: 'Google Calendar is not available right now.' })
    const { userId, password, returnTo } = req.body
    const user = await User.findById(userId).select('+password')
    if (!user) return res.status(404).json({ message: 'User not found.' })
    if (user.password) {
      if (typeof password !== 'string' || !password || !await bcrypt.compare(password, user.password)) {
        return res.status(401).json({ message: 'Wrong password. Please try again.' })
      }
    }
    const url = await startConnect(user, allowedReturnTo(returnTo, user.role))
    if (!url) return res.status(500).json({ message: 'Could not connect Google Calendar. Please try again.' })
    res.json({ url })
  } catch (err) {
    res.status(500).json({ message: 'Could not connect Google Calendar. Please try again.' })
  }
})

// GET /calendar/callback finishes consent and returns to an allowed client page.
router.get('/callback', async (req, res) => {
  try {
    const result = await finishConnect(req.query.code, req.query.state)
    res.redirect((process.env.CLIENT_URL || 'http://localhost:5173') + allowedReturnTo(result.returnTo))
  } catch (err) {
    res.redirect((process.env.CLIENT_URL || 'http://localhost:5173') + '/seller/orders')
  }
})

// GET /calendar/status/:userId returns only safe connection information.
router.get('/status/:userId', async (req, res) => {
  try {
    const user = await User.findById(req.params.userId)
    if (!user) return res.status(404).json({ message: 'User not found.' })
    res.json(calendarStatus(user))
  } catch (err) {
    res.status(500).json({ message: 'Could not load Calendar status. Please try again.' })
  }
})

// POST /calendar/disconnect clears the connection and returns connected: false.
router.post('/disconnect', async (req, res) => {
  try {
    if (typeof req.body.userId !== 'string' || !req.body.userId) return res.status(400).json({ message: 'A user id is required.' })
    const cleared = await disconnect(req.body.userId)
    if (!cleared) return res.status(500).json({ message: 'Could not disconnect Google Calendar. Please try again.' })
    res.json({ connected: false })
  } catch (err) {
    res.status(500).json({ message: 'Could not disconnect Google Calendar. Please try again.' })
  }
})

// GET /calendar/events/:userId lists events for a valid range of at most 31 days.
router.get('/events/:userId', async (req, res) => {
  try {
    if (typeof req.query.from !== 'string' || typeof req.query.to !== 'string') {
      return res.status(400).json({ message: 'Choose a valid date range of 31 days or less.' })
    }
    const from = new Date(req.query.from).getTime()
    const to = new Date(req.query.to).getTime()
    if (!(from < to) || to - from > 31 * 24 * 60 * 60 * 1000) { // Invalid, reversed and long ranges are rejected.
      return res.status(400).json({ message: 'Choose a valid date range of 31 days or less.' })
    }
    res.json(await listEvents(req.params.userId, req.query.from, req.query.to))
  } catch (err) {
    res.status(500).json({ message: 'Could not load Calendar events. Please try again.' })
  }
})

export default router
