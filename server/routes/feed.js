import express from 'express'
import mongoose from 'mongoose'
import Product from '../models/Product.js'
import User from '../models/User.js'
import Interaction from '../models/Interaction.js'

// Owner: Member 4 (FYP)
// GET /feed/:userId  (use "guest" when not logged in)    POST /feed/interactions
const router = express.Router()

const NEW_SELLER_DAYS = 30

router.get('/:userId', async (req, res) => {
  try {
    let preferences = []
    if (mongoose.isValidObjectId(req.params.userId)) {
      const user = await User.findById(req.params.userId)
      if (user) preferences = user.preferences
    }

    const products = await Product.find({ isAvailable: true }).populate(
      'shop',
      'name nearestMrt location stats createdAt'
    )

    const items = products
      .filter((p) => p.shop)
      .map((p) => {
        let score = 0
        const reasons = []

        if (preferences.includes(p.category)) {
          score += 3
          reasons.push(`Matches your interest in ${p.category}`)
        }

        const trust = p.shop.stats?.trustScore ?? 50 // from Yu Chen's trust-score module
        score += trust / 20
        if (trust >= 80) reasons.push('Highly rated seller')

        const shopAgeDays = (Date.now() - new Date(p.shop.createdAt)) / 86400000
        if (shopAgeDays <= NEW_SELLER_DAYS) {
          score += 2
          reasons.push('New seller - give them a try!')
        }

        if (reasons.length === 0) reasons.push('Something different to try')
        return { product: p, score, reason: reasons.join(' | ') }
      })

    items.sort((a, b) => b.score - a.score)
    res.json(items.slice(0, 20))
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// body: { user, product, shop, type }   type = view | save | impression | order
router.post('/interactions', async (req, res) => {
  try {
    const interaction = await Interaction.create(req.body)
    res.status(201).json(interaction)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// TODO (Member 4): boost categories the user has viewed/saved a lot (read the interactions collection)
// TODO (Member 4): add some diversity so one shop does not fill the whole feed
// TODO (Member 4): record "impression" interactions for products shown in the feed

export default router
