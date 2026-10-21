import Message from '../models/Message.js'
import Conversation from '../models/Conversation.js'
import Notification from '../models/Notification.js'

// Live updates (Socket.IO) that work even when every teammate runs their OWN server on localhost.
//
// Problem: a browser only hears events from the server it is connected to. If I send a chat
// message through my server, my friend's browser (connected to their server) never heard about it,
// even though the message is in the shared MongoDB Atlas database.
//
// Fix: every server WATCHES the shared database (MongoDB change streams). Whenever a message or
// notification is saved - by any server - each server tells its own connected browsers.
// If the database can't do change streams (e.g. a plain local mongod), we fall back to
// emitting straight from the route, which works when everyone uses the same server.
let io = null
let watching = false
let streams = []

// tell some users' browsers about something (rooms are joined in server.js)
function emitToUsers(users, event, payload) {
  const rooms = [...new Set(users.filter(Boolean).map((u) => `user:${u}`))]
  if (io && rooms.length > 0) io.to(rooms).emit(event, payload)
}

// Called from routes after saving. Skipped while watching, because the change stream
// will send it (otherwise this server's browsers would get every event twice).
export function emitFromRoute(users, event, payload) {
  if (!watching) emitToUsers(users, event, payload)
}

// a plain (non replica set) MongoDB can't do change streams at all
const notSupported = (err) => err.code === 40573 || /replica set|change stream/i.test(err.message)

function stop(err) {
  if (!watching) return
  watching = false
  streams.forEach((stream) => stream.close().catch(() => {}))
  streams = []
  if (notSupported(err)) {
    console.warn('Live updates: this database has no change streams, so only browsers on THIS server get live updates.')
  } else {
    console.warn('Live updates: lost the database watch, retrying in 30s -', err.message)
    setTimeout(start, 30000)
  }
}

function watch(model, pipeline, onChange) {
  const stream = model.watch(pipeline, { fullDocument: 'updateLookup' })
  stream.on('change', (change) => onChange(change).catch((err) => console.error('Live update failed:', err.message)))
  stream.on('error', stop)
  streams.push(stream)
}

function start() {
  if (watching) return
  watching = true

  // new chat message -> both people in the chat (list + open chat + red badge refresh)
  watch(Message, [{ $match: { operationType: 'insert' } }], async ({ fullDocument: message }) => {
    const conversation = await Conversation.findById(message.conversation).select('buyer seller').lean()
    if (!conversation) return
    emitToUsers([conversation.buyer, conversation.seller], 'new-message', {
      conversationId: String(message.conversation),
      sender: String(message.sender),
    })
  })

  // chat opened (unread count reset to 0) -> that person's other tabs / devices update their badge
  watch(Conversation, [{ $match: { operationType: 'update' } }], async ({ fullDocument: conversation, updateDescription }) => {
    const changed = Object.keys(updateDescription?.updatedFields || {})
    if (!conversation || !changed.some((f) => f === 'buyerUnread' || f === 'sellerUnread')) return
    emitToUsers([conversation.buyer, conversation.seller], 'unread-changed')
  })

  // new notification -> the bell refreshes
  watch(Notification, [{ $match: { operationType: 'insert' } }], async ({ fullDocument: notification }) => {
    emitToUsers([notification.user], 'notification')
  })

  console.log("Live updates: watching the database, so messages reach everyone's servers")
}

// server.js calls this once MongoDB is connected
export function startRealtime(socketServer) {
  io = socketServer
  start()
}
