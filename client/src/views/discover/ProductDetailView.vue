<script setup>
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import axios from 'axios'
import { API_URL } from '@/utils/config'
import { currentUser } from '@/utils/auth'
import { formatPrice, formatDateTime } from '@/utils/format'

// Owner: Member 3 - /products/:id
const route = useRoute()
const product = ref(null)

onMounted(async () => {
  try {
    const response = await axios.get(`${API_URL}/products/${route.params.id}`)
    product.value = response.data

    // tell the FYP that this buyer viewed this product (Member 4 uses this)
    if (currentUser.value) {
      await axios.post(`${API_URL}/feed/interactions`, {
        user: currentUser.value._id,
        product: product.value._id,
        shop: product.value.shop._id,
        type: 'view',
      })
    }
  } catch (error) {
    console.log(error.message)
  }
})
</script>

<template>
  <div v-if="product" class="row g-4">
    <div class="col-md-5">
      <img :src="product.imageUrl || '/placeholder.svg'" class="img-fluid rounded" :alt="product.name" />
    </div>
    <div class="col-md-7">
      <h2>{{ product.name }}</h2>
      <p class="text-muted">
        by <RouterLink :to="`/shops/${product.shop._id}`">{{ product.shop.name }}</RouterLink>
        <span v-if="product.shop.nearestMrt"> &middot; {{ product.shop.nearestMrt }} MRT</span>
      </p>
      <p class="fs-4 fw-bold">{{ formatPrice(product.price) }} <span class="fs-6 text-muted fw-normal">/ {{ product.unit }}</span></p>
      <p>{{ product.description }}</p>

      <h6>Available slots</h6>
      <ul>
        <li v-for="slot in product.orderSlots" :key="slot._id">{{ formatDateTime(slot.start) }}</li>
      </ul>
      <p v-if="product.orderSlots.length === 0" class="text-muted">No slots listed - ask the seller.</p>

      <RouterLink v-if="currentUser && currentUser.role === 'buyer'" :to="`/order/new/${product._id}`" class="btn btn-brand">
        Request order
      </RouterLink>
      <p v-else-if="!currentUser" class="text-muted">
        <RouterLink to="/login">Log in</RouterLink> as a buyer to order.
      </p>
    </div>
  </div>
</template>
