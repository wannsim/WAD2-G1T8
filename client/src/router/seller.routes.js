// Owner: Cheyenne
import ShopFormView from '@/views/seller/ShopFormView.vue'
import MyProductsView from '@/views/seller/MyProductsView.vue'
import ProductFormView from '@/views/seller/ProductFormView.vue'

export default [
  { path: '/seller/shop', component: ShopFormView },
  { path: '/seller/products', component: MyProductsView },
  { path: '/seller/products/new', component: ProductFormView },
  { path: '/seller/products/:id/edit', component: ProductFormView }, // :id = route parameter (Week 4)
]
