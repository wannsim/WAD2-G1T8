import express from 'express'
import cors from 'cors'
import mongoose from 'mongoose'
import dotenv from 'dotenv'
import http from 'http'
import { Server } from 'socket.io'
 
import userRoutes from './routes/users.js'
import shopRoutes from './routes/shops.js'
import productRoutes from './routes/products.js'
import discoverRoutes from './routes/discover.js'
import favouriteRoutes from './routes/favourites.js'
import feedRoutes from './routes/feed.js'
import orderRoutes from './routes/orders.js'
import reviewRoutes from './routes/reviews.js'
import chatRoutes from './routes/chats.js'
import notificationRoutes from './routes/notifications.js'
import { startRealtime } from './utils/realtime.js'
import { startTrendRefresh } from './utils/trends.js'
 
dotenv.config({ path: './config.env' })
 
const app = express()
app.use(cors())
app.use(express.json())
 
// Socket.IO runs on the same HTTP server as Express (same port 8000)
const httpServer = http.createServer(app)
const io = new Server(httpServer, { cors: { origin: '*' } })
app.set('io', io) // route files can reach it with req.app.get('io')
 
// Every logged-in browser joins a private "room" named after its user id.
// To notify someone we just send to their room.
io.on('connection', (socket) => {
  socket.on('join', (userId) => {
    if (typeof userId === 'string') socket.join(`user:${userId}`)
  })
  socket.on('leave', (userId) => {
    if (typeof userId === 'string') socket.leave(`user:${userId}`)
  })
})
 
app.use('/users', userRoutes)
app.use('/shops', shopRoutes)
app.use('/products', productRoutes)
app.use('/discover', discoverRoutes)
app.use('/favourites', favouriteRoutes)
app.use('/feed', feedRoutes)
app.use('/orders', orderRoutes)
app.use('/reviews', reviewRoutes)
app.use('/chats', chatRoutes)
app.use('/notifications', notificationRoutes)
app.use('/api/products', productRoutes)
app.use('/api/shops', shopRoutes)
 
app.get('/', (req, res) => res.json({ message: 'Homly Hauls API is running' }))
 
const PORT = process.env.PORT || 8000
 
mongoose
  .connect(process.env.DB)
  .then(() => {
    console.log('MongoDB connected')
    startRealtime(io) // live chat / notifications, even when each teammate runs their own server
    startTrendRefresh() // online trends for the Trending tab (free Wikimedia API, no key)
    // NOTE: httpServer.listen (not app.listen) so Socket.IO works
    httpServer.listen(PORT, () => console.log(`API running on http://localhost:${PORT}`))
  })
  .catch((err) => console.error('MongoDB connection failed:', err.message))
 