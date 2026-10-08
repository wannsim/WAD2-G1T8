import express from 'express'
import bcrypt from 'bcryptjs'
import User from '../models/User.js'

// Owner: Wan Sim
// POST /users/register   POST /users/login   GET /users/:id   PUT /users/:id
const router = express.Router()

// never send the password hash back to the client
function safeUser(u) {
  return { _id: u._id, name: u.name, email: u.email, role: u.role, preferences: u.preferences }
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
    const ok = user && (await bcrypt.compare(password || '', user.password))
    if (!ok) return res.status(401).json({ message: 'Wrong email or password' })
    res.json(safeUser(user))
  } catch (err) {
    res.status(500).json({ message: err.message })
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
    const { name, preferences } = req.body
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { name, preferences },
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
