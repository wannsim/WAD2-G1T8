import mongoose from 'mongoose'
 
// Save as: server/models/Conversation.js | collection: conversations
// One conversation per (buyer, shop) pair. The chat is between the buyer and the shop's owner.
const conversationSchema = new mongoose.Schema(
  {
    buyer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },  // the person who started the chat
    seller: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // = shop.owner
    shop: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true },
    lastMessage: { type: String, default: '' }, // preview shown in the chat list
    lastMessageAt: { type: Date, default: Date.now }, // list is sorted by this
    buyerUnread: { type: Number, default: 0 },  // messages the buyer has not read yet
    sellerUnread: { type: Number, default: 0 }, // messages the seller has not read yet
  },
  { timestamps: true }
)
conversationSchema.index({ buyer: 1, shop: 1 }, { unique: true }) // never two chats for the same buyer + shop
 
export default mongoose.model('Conversation', conversationSchema)
 