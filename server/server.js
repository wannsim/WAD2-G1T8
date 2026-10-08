import express from 'express'
import cors from 'cors'
import mongoose from 'mongoose'
import dotenv from 'dotenv'

import userRoutes from './routes/users.js'
import shopRoutes from './routes/shops.js'
import productRoutes from './routes/products.js'
import discoverRoutes from './routes/discover.js'
import favouriteRoutes from './routes/favourites.js'
import feedRoutes from './routes/feed.js'
import orderRoutes from './routes/orders.js'
import reviewRoutes from './routes/reviews.js'

dotenv.config({ path: './config.env' })

const app = express()
app.use(cors())
app.use(express.json())

// All routers are already mounted here, so nobody needs to edit this file.
app.use('/users', userRoutes)          // Wan Sim
app.use('/shops', shopRoutes)          // Cheyenne
app.use('/products', productRoutes)    // Cheyenne
app.use('/discover', discoverRoutes)   // Member 3
app.use('/favourites', favouriteRoutes) // Member 3
app.use('/feed', feedRoutes)           // Member 4
app.use('/orders', orderRoutes)        // Basile
app.use('/reviews', reviewRoutes)      // Yu Chen

app.get('/', (req, res) => res.json({ message: 'HomeBiz API is running' }))

const PORT = process.env.PORT || 8000

mongoose
  .connect(process.env.DB)
  .then(() => {
    console.log('MongoDB connected')
    app.listen(PORT, () => console.log(`API running on http://localhost:${PORT}`))
  })
  .catch((err) => console.error('MongoDB connection failed:', err.message))
