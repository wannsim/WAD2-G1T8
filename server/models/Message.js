import mongoose from 'mongoose'
 
// Save as: server/models/Message.js | collection: messages
const messageSchema = new mongoose.Schema(
  {
    conversation: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', required: true },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    text: { type: String, required: true, trim: true, maxlength: 1000 },
  },
  { timestamps: true } // createdAt = time the message was sent
)
messageSchema.index({ conversation: 1, createdAt: 1 })
 
export default mongoose.model('Message', messageSchema)
 