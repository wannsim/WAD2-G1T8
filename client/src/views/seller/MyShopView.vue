<template>
  <div class="container mt-4" v-if="shop">
    <div class="p-4 bg-light rounded mb-4">
      <h2>{{ shop.name }}</h2>
      <p><strong>Location (Nearest MRT):</strong> {{ shop.nearestMrt }}</p>
      <p><strong>Experience:</strong> {{ shop.experience }}</p>
      <div>
        <span class="badge bg-secondary me-1" v-for="cat in shop.categories" :key="cat">{{ cat }}</span>
      </div>
    </div>

    <h4>Products & Services</h4>
    <p class="small text-muted mb-2">
      Pin up to {{ MAX_PINS }} products to show them first on your shop page ({{ pinnedIds.length }}/{{ MAX_PINS }} pinned)
    </p>
    <p v-if="pinError" class="text-danger small">{{ pinError }}</p>
    <p v-if="loadingProducts" class="text-muted">Loading products...</p>
    <p v-else-if="products.length === 0" class="text-muted">You have not listed any products yet.</p>
    <div class="row">
      <div class="col-md-3 mb-3" v-for="item in sortedProducts" :key="item._id">
        <div class="card h-100 shadow-sm" :class="{ 'border-warning': isPinned(item) }">
          <!-- photo is loaded from its own URL (lazy), not sent inside the JSON -->
          <img :src="item.imageUrl || '/placeholder.svg'" class="card-img-top product-img" :alt="item.name"
            loading="lazy" decoding="async" @error="$event.target.src = '/placeholder.svg'">
          <div class="card-body d-flex flex-column">
            <h6 class="card-title">{{ item.name }}</h6>
            <span class="badge" :class="item.type === 'service' ? 'bg-info text-dark' : 'bg-success'">
              {{ (item.category || 'product').toUpperCase() }}
            </span>
            <p class="card-text mt-2">${{ item.price }}</p>
            <button type="button" class="btn btn-sm btn-outline-primary mt-auto mb-2" @click="editModal.open(item)">Edit</button>
            <button type="button" class="btn btn-sm" :disabled="pinning"
              :class="isPinned(item) ? 'btn-warning' : 'btn-outline-warning'" @click="togglePin(item)">
              {{ isPinned(item) ? 'Pinned (click to unpin)' : 'Pin' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <EditProductModal ref="editModal" @saved="onProductSaved" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import axios from 'axios'
import { currentUser } from '@/utils/auth'
import { API_URL } from '@/utils/config'
import EditProductModal from '@/components/EditProductModal.vue'

const shop = ref(null)
const products = ref([])
const loadingProducts = ref(true)

// edit a listing in a pop-up, then swap the updated product into the list
const editModal = ref(null)
const onProductSaved = (updated) => {
  const index = products.value.findIndex((p) => p._id === updated._id)
  if (index !== -1) products.value[index] = updated
}

// pinned products (shown first on the shop page)
const MAX_PINS = 3
const pinnedIds = ref([])
const pinning = ref(false)
const pinError = ref('')
const isPinned = (item) => pinnedIds.value.includes(item._id)
// pinned first (in the order they were pinned), the rest stay newest first
const pinRank = (item) => (isPinned(item) ? pinnedIds.value.indexOf(item._id) : MAX_PINS)
const sortedProducts = computed(() => [...products.value].sort((a, b) => pinRank(a) - pinRank(b)))

async function togglePin(item) {
  pinError.value = ''
  pinning.value = true
  try {
    const res = await axios.put(`${API_URL}/shops/${shop.value._id}/pin`, { user: currentUser.value._id, productId: item._id })
    pinnedIds.value = res.data.pinnedProducts.map(String)
  } catch (err) {
    pinError.value = err.response?.data?.message || err.message
  } finally {
    pinning.value = false
  }
}

onMounted(async () => {
  try {
    if (!currentUser.value || !currentUser.value._id) return

    // 1. Fetch the logged-in user's shop using their ID
    const res = await axios.get(`http://localhost:8000/api/shops/mine/${currentUser.value._id}`)
    
    if (res.data) {
      shop.value = res.data
      pinnedIds.value = (res.data.pinnedProducts || []).map(String)
      
      // 2. Fetch products belonging to this shop
      const prodRes = await axios.get(`http://localhost:8000/api/products/shop/${shop.value._id}`)
      products.value = prodRes.data
    }
  } catch (error) {
    console.error("Error loading shop data", error)
  } finally {
    loadingProducts.value = false
  }
})
</script>