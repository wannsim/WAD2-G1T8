import { createRouter, createWebHistory } from 'vue-router'

// Each teammate edits ONLY their own *.routes.js file, so we never fight over this one.
import authRoutes from './auth.routes'         // Wan Sim
import sellerRoutes from './seller.routes'     // Cheyenne
import discoverRoutes from './discover.routes' // Member 3
import feedRoutes from './feed.routes'         // Member 4
import orderRoutes from './order.routes'       // Basile
import reviewRoutes from './review.routes'     // Yu Chen

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
    { path: '/:pathMatch(.*)*', redirect: '/home' }, // unknown URL -> home
  ],
})

export default router
