import express from 'express'
import mongoose from 'mongoose'
import Conversation from '../models/Conversation.js'
import Message from '../models/Message.js'
import Shop from '../models/Shop.js'
import { emitFromRoute } from '../utils/realtime.js'
 
// Save as: server/routes/chats.js
// POST /chats/start               find or create the chat between a buyer and a shop
// GET  /chats/unread/:userId      total unread messages (for the navbar badge)
// GET  /chats/user/:userId        all chats of one user (for the chat list)
// GET  /chats/:id/messages?userId=   messages of one chat (also marks them as read for that user)
// POST /chats/:id/messages        send a message
const router = express.Router()
 
// ---- start (or reopen) a chat with a shop ----  body: { buyer, shop }
router.post('/start', async (req, res) => {
  try {
    const { buyer, shop: shopId } = req.body
    if (!mongoose.isValidObjectId(buyer) || !mongoose.isValidObjectId(shopId)) {
      return res.status(400).json({ message: 'Invalid buyer or shop' })
    }
    const shop = await Shop.findById(shopId)
    if (!shop) return res.status(404).json({ message: 'Shop not found' })
    if (String(shop.owner) === String(buyer)) {
      return res.status(400).json({ message: 'You cannot chat with your own shop' })
    }
 
    // upsert = "use the existing chat if there is one, otherwise create it"
    const conversation = await Conversation.findOneAndUpdate(
      { buyer, shop: shop._id },
      { $setOnInsert: { seller: shop.owner } },
      { upsert: true, new: true }
    )
    res.json(conversation)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})
 
// ---- unread count for the navbar badge ----
router.get('/unread/:userId', async (req, res) => {
  try {
    const { userId } = req.params
    if (!mongoose.isValidObjectId(userId)) return res.json({ unread: 0 })
    const conversations = await Conversation.find({ $or: [{ buyer: userId }, { seller: userId }] })
    let unread = 0
    conversations.forEach((c) => {
      unread += String(c.buyer) === String(userId) ? c.buyerUnread : c.sellerUnread
    })
    res.json({ unread })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})
 
// ---- the user's chat list ----
router.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params
    if (!mongoose.isValidObjectId(userId)) return res.json([])
    const conversations = await Conversation.find({ $or: [{ buyer: userId }, { seller: userId }] })
      .populate('buyer', 'name')
      .populate('shop', 'name')
      .sort({ lastMessageAt: -1 })
 
    const list = conversations.map((c) => {
      const isBuyer = String(c.buyer._id) === String(userId)
      return {
        _id: c._id,
        title: isBuyer ? c.shop.name : c.buyer.name, // buyers see the shop name, sellers see the buyer's name
        lastMessage: c.lastMessage,
        lastMessageAt: c.lastMessageAt,
        unread: isBuyer ? c.buyerUnread : c.sellerUnread,
      }
    })
    res.json(list)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})
 
// ---- messages of one chat ----
router.get('/:id/messages', async (req, res) => {
  try {
    const { userId } = req.query
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'Chat not found' })
    const conversation = await Conversation.findById(req.params.id).populate('buyer', 'name').populate('shop', 'name')
    if (!conversation) return res.status(404).json({ message: 'Chat not found' })
 
    const isBuyer = String(conversation.buyer._id) === String(userId)
    const isSeller = String(conversation.seller) === String(userId)
    if (!isBuyer && !isSeller) return res.status(403).json({ message: 'This is not your chat' })
 
    // opening the chat = reading it
    await Conversation.updateOne(
      { _id: conversation._id },
      isBuyer ? { buyerUnread: 0 } : { sellerUnread: 0 }
    )
 
    emitFromRoute([userId], 'unread-changed') // navbar badge refreshes
 
    const messages = await Message.find({ conversation: conversation._id }).sort({ createdAt: 1 })
    res.json({ title: isBuyer ? conversation.shop.name : conversation.buyer.name, messages })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})
 
// ---- send a message ----  body: { sender, text }
router.post('/:id/messages', async (req, res) => {
  try {
    const { sender } = req.body
    const text = (req.body.text || '').trim()
    if (!text) return res.status(400).json({ message: 'Message cannot be empty' })
    if (text.length > 1000) return res.status(400).json({ message: 'Message is too long (max 1000 characters)' })
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'Chat not found' })
 
    const conversation = await Conversation.findById(req.params.id)
    if (!conversation) return res.status(404).json({ message: 'Chat not found' })
 
    const fromBuyer = String(conversation.buyer) === String(sender)
    const fromSeller = String(conversation.seller) === String(sender)
    if (!fromBuyer && !fromSeller) return res.status(403).json({ message: 'This is not your chat' })
 
    const message = await Message.create({ conversation: conversation._id, sender, text })
    await Conversation.updateOne(
      { _id: conversation._id },
      {
        lastMessage: text.slice(0, 80),
        lastMessageAt: new Date(),
        // the OTHER person now has one more unread message
        $inc: fromBuyer ? { sellerUnread: 1 } : { buyerUnread: 1 },
      }
    )
 
    // real-time push: both people's browsers hear about it straight away (see utils/realtime.js)
    emitFromRoute([conversation.buyer, conversation.seller], 'new-message', {
      conversationId: String(conversation._id),
      sender: String(sender),
    })
 
    res.status(201).json(message)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})
 
export default router
 