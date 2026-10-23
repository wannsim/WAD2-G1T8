import { createRouter, createWebHistory } from 'vue-router'

import authRoutes from './auth.routes'         
import sellerRoutes from './seller.routes'     
import discoverRoutes from './discover.routes' 
import feedRoutes from './feed.routes'         
import orderRoutes from './order.routes'       
import reviewRoutes from './review.routes'     
import chatRoutes from './chat.routes' 
import notificationRoutes from './notification.routes'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', redirect: '/home' }, // Week 4: redirect
    ...authRoutes,
    ...sellerRoutes,
    ...discoverRoutes,
    ...feedRoutes,
    ...orderRoutes,
    ...reviewRoutes,
    ...chatRoutes, 
    ...notificationRoutes,
    { path: '/:pathMatch(.*)*', redirect: '/home' }, // unknown URL -> home
  ],
})

export default router
