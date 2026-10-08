// Owner: Basile
import OrderRequestView from '@/views/orders/OrderRequestView.vue'
import BuyerOrdersView from '@/views/orders/BuyerOrdersView.vue'
import SellerOrdersView from '@/views/orders/SellerOrdersView.vue'

export default [
  { path: '/order/new/:productId', component: OrderRequestView },
  { path: '/orders', component: BuyerOrdersView },
  { path: '/seller/orders', component: SellerOrdersView },
]
