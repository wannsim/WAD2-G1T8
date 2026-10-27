import express from 'express'
import multer from 'multer'
import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'
import User from '../models/User.js'
import { OAuth2Client } from 'google-auth-library'

// Owner: Wan Sim
// POST /users/register   POST /users/login   GET /users/:id   PUT /users/:id
// POST/DELETE/GET /users/:id/avatar (profile picture)
const router = express.Router()

// never send the password hash back to the client
function safeUser(u) {
  return {
    _id: u._id, name: u.name, email: u.email, role: u.role, preferences: u.preferences, preferredMrt: u.preferredMrt || '',
    deliveryAddress: u.deliveryAddress || '', deliveryUnit: u.deliveryUnit || '', deliveryPostalCode: u.deliveryPostalCode || '',
    avatarUpdatedAt: u.avatarUpdatedAt || null,
  }
}

const POSTAL_CODE = /^\d{6}$/ // Singapore postal codes are 6 digits

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
    const { name, preferences, preferredMrt, deliveryAddress, deliveryUnit, deliveryPostalCode } = req.body
    const changes = { name, preferences, preferredMrt: String(preferredMrt || '').trim() }
    // the address is optional, and only changed when the page sends it
    if (deliveryAddress !== undefined) changes.deliveryAddress = String(deliveryAddress || '').trim()
    if (deliveryUnit !== undefined) changes.deliveryUnit = String(deliveryUnit || '').trim()
    if (deliveryPostalCode !== undefined) {
      changes.deliveryPostalCode = String(deliveryPostalCode || '').trim()
      if (changes.deliveryPostalCode && !POSTAL_CODE.test(changes.deliveryPostalCode)) {
        return res.status(400).json({ message: 'Postal code must be 6 digits.' })
      }
    }
    const user = await User.findByIdAndUpdate(req.params.id, changes, { new: true, runValidators: true })
    if (!user) return res.status(404).json({ message: 'User not found' })
    res.json(safeUser(user))
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// ---------- profile picture (buyers; sellers use their shop's picture) ----------
// images only, max 5MB
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(null, file.mimetype.startsWith('image/')),
})
function uploadImage(req, res, next) {
  upload.single('image')(req, res, (err) => {
    if (!err) return next()
    res.status(400).json({ message: err.code === 'LIMIT_FILE_SIZE' ? 'Image is too big (max 5MB)' : err.message })
  })
}
// only the account owner may change it (body.user must be the same id)
function isMe(req, res) {
  if (!mongoose.isValidObjectId(req.params.id) || String(req.body?.user) !== req.params.id) {
    res.status(403).json({ message: 'You can only change your own profile picture' })
    return false
  }
  return true
}

// upload / replace it. multipart form: user (text) + image (file). Returns the updated user
router.post('/:id/avatar', uploadImage, async (req, res) => {
  try {
    if (!isMe(req, res)) return
    if (!req.file) return res.status(400).json({ message: 'Please choose an image file (max 5MB)' })
    const avatar = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`
    const user = await User.findByIdAndUpdate(req.params.id, { avatar, avatarUpdatedAt: new Date() }, { new: true })
    if (!user) return res.status(404).json({ message: 'User not found' })
    res.json(safeUser(user))
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// remove it (back to the first letter of the name). body: { user }
router.delete('/:id/avatar', async (req, res) => {
  try {
    if (!isMe(req, res)) return
    const user = await User.findByIdAndUpdate(req.params.id, { $unset: { avatar: 1 }, avatarUpdatedAt: null }, { new: true })
    if (!user) return res.status(404).json({ message: 'User not found' })
    res.json(safeUser(user))
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// the picture itself. Use ?v=<avatarUpdatedAt> so a new picture isn't hidden by the cache
router.get('/:id/avatar', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.sendStatus(404)
    const user = await User.findById(req.params.id).select('+avatar').lean()
    const match = /^data:(.+?);base64,(.+)$/s.exec(user?.avatar || '')
    if (!match) return res.sendStatus(404)
    res.set('Content-Type', match[1])
    res.set('Cache-Control', 'public, max-age=604800')
    res.send(Buffer.from(match[2], 'base64'))
  } catch (err) {
    res.sendStatus(500)
  }
})

// TODO (Wan Sim): change password, delete account

export default router
