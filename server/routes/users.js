import express from 'express'
import bcrypt from 'bcryptjs'
import User from '../models/User.js'
import { OAuth2Client } from 'google-auth-library'

// Owner: Wan Sim
// POST /users/register   POST /users/login   GET /users/:id   PUT /users/:id
const router = express.Router()

// never send the password hash back to the client
function safeUser(u) {
  return { _id: u._id, name: u.name, email: u.email, role: u.role, preferences: u.preferences, preferredMrt: u.preferredMrt || '' }
}

router.post('/register', async (req, res) => {
  try {
    const { name, email, password, role } = req.body
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email and password are required' })
    }
    const exists = await User.findOne({ email: email.toLowerCase() })
    if (exists) return res.status(409).json({ message: 'Email is already registered' })

    const hash = await bcrypt.hash(password, 10)
    const user = await User.create({ name, email, password: hash, role })
    res.status(201).json(safeUser(user))
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body
    const user = await User.findOne({ email: (email || '').toLowerCase() })
    const ok = user && user.password && (await bcrypt.compare(password || '', user.password))
    if (!ok) return res.status(401).json({ message: 'Wrong email or password' })
    res.json(safeUser(user))
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID)

router.post('/google', async (req, res) => {
  try {
    const { credential, role } = req.body
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    })
    const { email, name, sub, email_verified } = ticket.getPayload()
    if (!email_verified) return res.status(400).json({ message: 'Google email is not verified' })

    let user = await User.findOne({ email })
    if (!user) {
      user = await User.create({ name, email, googleId: sub, role: role === 'seller' ? 'seller' : 'buyer' })
    } else if (!user.googleId) {
      user.googleId = sub // link an existing email/password account
      await user.save()
    }
    res.json(safeUser(user))
  } catch (err) {
    res.status(401).json({ message: 'Google sign-in failed' })
  }
})

router.get('/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
    if (!user) return res.status(404).json({ message: 'User not found' })
    res.json(safeUser(user))
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

router.put('/:id', async (req, res) => {
  try {
    const { name, preferences, preferredMrt } = req.body
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { name, preferences, preferredMrt: String(preferredMrt || '').trim() },
      { new: true, runValidators: true }
    )
    if (!user) return res.status(404).json({ message: 'User not found' })
    res.json(safeUser(user))
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// TODO (Wan Sim): change password, delete account

export default router
