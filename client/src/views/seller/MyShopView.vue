<template>
  <div class="container mt-4" v-if="shop">
    <div class="p-4 bg-light rounded mb-4">
      <h2>{{ shop.name }}</h2>
      <p><strong>📍 Location (Nearest MRT):</strong> {{ shop.nearestMrt }}</p>
      <p><strong>Experience:</strong> {{ shop.experience }}</p>
      <div>
        <span class="badge bg-secondary me-1" v-for="cat in shop.categories" :key="cat">{{ cat }}</span>
      </div>
    </div>

    <div v-if="shop.pinnedProduct" class="mb-4 p-3 border border-warning rounded">
      <h5>📌 Pinned: {{ shop.pinnedProduct.name }}</h5>
    </div>

    <h4>Products & Services</h4>
    <p v-if="loadingProducts" class="text-muted">Loading products...</p>
    <p v-else-if="products.length === 0" class="text-muted">You have not listed any products yet.</p>
    <div class="row">
      <div class="col-md-3 mb-3" v-for="item in products" :key="item._id">
        <div class="card h-100 shadow-sm">
          <!-- photo is loaded from its own URL (lazy), not sent inside the JSON -->
          <img :src="item.imageUrl || '/placeholder.svg'" class="card-img-top product-img" :alt="item.name"
            loading="lazy" decoding="async" @error="$event.target.src = '/placeholder.svg'">
          <div class="card-body">
            <h6 class="card-title">{{ item.name }}</h6>
            <span class="badge" :class="item.type === 'service' ? 'bg-info text-dark' : 'bg-success'">
              {{ (item.category || 'product').toUpperCase() }}
            </span>
            <p class="card-text mt-2">${{ item.price }}</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import axios from 'axios'
import { currentUser } from '@/utils/auth'

const shop = ref(null)
const products = ref([])
const loadingProducts = ref(true)

onMounted(async () => {
  try {
    if (!currentUser.value || !currentUser.value._id) return

    // 1. Fetch the logged-in user's shop using their ID
    const res = await axios.get(`http://localhost:8000/api/shops/mine/${currentUser.value._id}`)
    
    if (res.data) {
      shop.value = res.data
      
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