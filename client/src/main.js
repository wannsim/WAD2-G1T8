import 'bootstrap/dist/css/bootstrap.min.css'
import 'bootstrap/dist/js/bootstrap.bundle.min.js'
import './assets/main.css' // our own CSS goes AFTER bootstrap so it can override it

import { createApp } from 'vue'
import App from './App.vue'
import router from './router'

// Shared components registered globally (Week 6: Global Registration)
// -> use <ProductCard /> and <StarRating /> in any component without importing them
import ProductCard from './components/ProductCard.vue'
import StarRating from './components/StarRating.vue'

const app = createApp(App)
app.component('ProductCard', ProductCard)
app.component('StarRating', StarRating)
app.use(router)
app.mount('#app')
