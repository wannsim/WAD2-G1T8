<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'
import { API_URL } from '@/utils/config'
import { currentUser } from '@/utils/auth'
import ReviewList from '@/components/ReviewList.vue'
 
// Save as: client/src/views/seller/MyShopView.vue   (Owner: Cheyenne)
// The seller's own shop page = the buyer's shop page (ShopView) + edit / pin / delete controls.
// If the header below is changed in ShopView.vue, copy the change here so both pages still match.
const router = useRouter()
const shop = ref(null)
const products = ref([])
const error = ref('')
 
function isPinned(product) {
  return shop.value !== null && shop.value.pinnedProduct === product._id
}
 
// pinned product first, everything else keeps its order
const sortedProducts = computed(() =>
  [...products.value].sort((a, b) => Number(isPinned(b)) - Number(isPinned(a)))
)
 
async function loadShop() {
  try {
    const shopResponse = await axios.get(`${API_URL}/shops/mine/${currentUser.value._id}`)
    if (!shopResponse.data) {
      router.push('/seller/shop/edit') // no shop yet -> create one first
      return
    }
    shop.value = shopResponse.data
    const productResponse = await axios.get(`${API_URL}/products`, { params: { shop: shop.value._id } })
    products.value = productResponse.data
  } catch (err) {
    error.value = err.message
  }
}
 
// one pinned product at a time: pinning another one replaces it, pinning the same one un-pins it
async function togglePin(product) {
  error.value = ''
  const newId = isPinned(product) ? null : product._id
  try {
    await axios.put(`${API_URL}/shops/${shop.value._id}/pin`, { productId: newId })
    shop.value.pinnedProduct = newId
  } catch (err) {
    error.value = err.response?.data?.message || err.message
  }
}
 
async function deleteProduct(product) {
  if (!window.confirm(`Delete "${product.name}"?`)) return
  try {
    await axios.delete(`${API_URL}/products/${product._id}`)
    if (isPinned(product)) shop.value.pinnedProduct = null
    products.value = products.value.filter((p) => p._id !== product._id)
  } catch (err) {
    error.value = err.message
  }
}
 
onMounted(() => {
  if (!currentUser.value || currentUser.value.role !== 'seller') {
    router.push('/login')
    return
  }
  loadShop()
})
</script>
 
<template>
  <div v-if="shop">
    <div v-if="error" class="alert alert-danger py-2 small">{{ error }}</div>
 
    <!-- header (same as the buyer's shop page) + owner buttons -->
    <div class="d-flex justify-content-between align-items-start flex-wrap gap-2">
      <div>
        <h2 class="mb-0">{{ shop.name }}</h2>
        <p v-if="shop.nearestMrt" class="text-muted mb-1">{{ shop.nearestMrt }} MRT</p>
      </div>
      <div>
        <RouterLink to="/seller/shop/edit" class="btn btn-outline-secondary btn-sm me-2">Edit shop profile</RouterLink>
        <RouterLink to="/seller/products/new" class="btn btn-brand btn-sm">+ Add product</RouterLink>
      </div>
    </div>
 
    <p class="mt-2">{{ shop.description }}</p>
 
    <div class="mb-3">
      <span v-if="shop.pickup" class="badge bg-success me-1">Pickup</span>
      <span v-if="shop.delivery" class="badge bg-primary me-1">Delivery</span>
    </div>
 
    <div class="card card-body mb-3">
      <div>
        <StarRating :value="shop.stats.avgRating" />
        {{ shop.stats.avgRating }} ({{ shop.stats.reviewCount }} reviews)
      </div>
      <div class="small text-muted">
        Trust score {{ shop.stats.trustScore }}/100 &middot;
        Fulfilment {{ Math.round(shop.stats.fulfilmentRate * 100) }}% &middot;
        Cancellation {{ Math.round(shop.stats.cancellationRate * 100) }}% &middot;
        Replies in about {{ shop.stats.avgResponseMins }} min
      </div>
    </div>
 
    <p class="small text-muted">
      This is how buyers see your shop, with your controls added.
      <RouterLink :to="`/shops/${shop._id}`">View public page</RouterLink>
    </p>
 
    <div class="d-flex justify-content-between align-items-center mb-1">
      <h4 class="mb-0">Products</h4>
      <span class="small text-muted">📌 A pinned product is shown first on your shop page</span>
    </div>
 
    <p v-if="products.length === 0" class="text-muted mt-3">You have not listed any products yet.</p>
 
    <div class="row g-3 my-2 mb-5">
      <div v-for="p in sortedProducts" :key="p._id" class="col-sm-6 col-lg-3">
        <ProductCard :product="p">
          <div class="d-flex align-items-center gap-2">
            <span v-if="isPinned(p)" title="Pinned to the top of your shop">📌</span>
            <div class="dropdown">
              <button class="btn btn-sm btn-outline-secondary dropdown-toggle" type="button" data-bs-toggle="dropdown">
                Manage
              </button>
              <ul class="dropdown-menu dropdown-menu-end">
                <li>
                  <button class="dropdown-item" type="button" @click="togglePin(p)">
                    {{ isPinned(p) ? 'Unpin from top' : 'Pin to top' }}
                  </button>
                </li>
                <li><RouterLink class="dropdown-item" :to="`/seller/products/${p._id}/edit`">Edit product</RouterLink></li>
                <li><button class="dropdown-item text-danger" type="button" @click="deleteProduct(p)">Delete</button></li>
              </ul>
            </div>
          </div>
        </ProductCard>
      </div>
    </div>
 
    <ReviewList :shop-id="shop._id" />
  </div>
</template>
 