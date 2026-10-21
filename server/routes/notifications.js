import express from 'express'
import mongoose from 'mongoose'
import Notification from '../models/Notification.js'
import Favourite from '../models/Favourite.js'

// Owner: Cheyenne
// GET /notifications/:userId?limit=5   PUT /notifications/read-all   PUT /notifications/:id/read
// DELETE /notifications/:id   POST /notifications/:id/remove-favourite
// Notifications are created in other routes with utils/notify.js
const router = express.Router()

// newest first, plus how many are unread (for the red badge on the bell)
router.get('/:userId', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.userId)) return res.status(400).json({ message: 'Invalid user' })
    const limit = Math.min(Number(req.query.limit) || 100, 100)
    const [notifications, unread] = await Promise.all([
      Notification.find({ user: req.params.userId }).sort({ createdAt: -1 }).limit(limit).lean(),
      Notification.countDocuments({ user: req.params.userId, read: false }),
    ])
    res.json({ notifications, unread })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// body: { user }
// NOTE: must be defined BEFORE '/:id/read'
router.put('/read-all', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.body.user)) return res.status(400).json({ message: 'Invalid user' })
    await Notification.updateMany({ user: req.body.user, read: false }, { read: true })
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// finds the notification only if it belongs to body.user
async function findMine(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    res.status(404).json({ message: 'Notification not found' })
    return null
  }
  const notification = await Notification.findOne({ _id: req.params.id, user: req.body?.user })
  if (!notification) res.status(404).json({ message: 'Notification not found' })
  return notification
}

// mark one as read (when the user clicks it). body: { user }
router.put('/:id/read', async (req, res) => {
  try {
    const notification = await findMine(req, res)
    if (!notification) return
    notification.read = true
    await notification.save()
    res.json(notification)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// delete one (the x button). body: { user }
router.delete('/:id', async (req, res) => {
  try {
    const notification = await findMine(req, res)
    if (!notification) return
    await notification.deleteOne()
    res.json({ deleted: req.params.id })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// "Remove" button on a sold out / deleted favourite: takes it out of the buyer's favourites. body: { user }
router.post('/:id/remove-favourite', async (req, res) => {
  try {
    const notification = await findMine(req, res)
    if (!notification) return
    if (notification.type !== 'favourite-unavailable') return res.status(400).json({ message: 'Nothing to remove' })
    await Favourite.deleteOne({ user: notification.user, product: notification.product })
    notification.done = true
    notification.read = true
    await notification.save()
    res.json(notification)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

export default router
