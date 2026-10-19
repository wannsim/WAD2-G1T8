// Owner: Cheyenne
import ShopFormView from '@/views/seller/ShopFormView.vue'
import MyProductsView from '@/views/seller/MyProductsView.vue'
import ProductFormView from '@/views/seller/ProductFormView.vue'
import MyShopView from '@/views/seller/MyShopView.vue'


export default [
  { path: '/seller/analytics', component: () => import('@/views/seller/SalesAnalyticsView.vue') },
  { path: '/seller/shop', component: MyShopView },      
  { path: '/seller/shop/edit', component: ShopFormView }, // the form moves here
  { path: '/seller/products', component: MyProductsView },
  { path: '/seller/products/new', component: ProductFormView },
  { path: '/seller/products/:id/edit', component: ProductFormView }, // :id = route parameter (Week 4)
]
