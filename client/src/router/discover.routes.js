// Owner: Member 3
import BrowseView from '@/views/discover/BrowseView.vue'
import MapView from '@/views/discover/MapView.vue'
import FavouritesView from '@/views/discover/FavouritesView.vue'
import ProductDetailView from '@/views/discover/ProductDetailView.vue'
import ShopView from '@/views/discover/ShopView.vue'

export default [
  { path: '/browse', component: BrowseView },
  { path: '/map', component: MapView },
  { path: '/favourites', component: FavouritesView },
  { path: '/products/:id', component: ProductDetailView },
  { path: '/shops/:id', component: ShopView },
]
