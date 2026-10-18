<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import axios from 'axios'
import { API_URL } from '@/utils/config'
import { currentUser } from '@/utils/auth'
import { formatPrice, formatDateTime } from '@/utils/format'
import FollowButton from '@/components/FollowButton.vue'

// Owner: Member 3 - /products/:id
const route = useRoute()
const product = ref(null)

const router = useRouter()
const chatError = ref('')

async function chatWithSeller() {
  chatError.value = ''
  try {
    const response = await axios.post(`${API_URL}/chats/start`, {
      buyer: currentUser.value._id,
      shop: product.value.shop._id,
    })
    router.push(`/chats/${response.data._id}`) // opens the chat tab with this chat open
  } catch (error) {
    chatError.value = error.response?.data?.message || error.message
  }
}

const loading = ref(true)
const loadError = ref('')

onMounted(async () => {
  try {
    const response = await axios.get(`${API_URL}/products/${route.params.id}`)
    product.value = response.data
  } catch (error) {
    loadError.value = error.response?.status === 404
      ? 'This product could not be found. It may have been removed by the seller.'
      : 'Could not load this product. Please try again.'
    console.log(error.message)
  } finally {
    loading.value = false
  }

  // tell the FYP that this buyer viewed this product (Member 4 uses this).
  // Runs in the background so it never stops the page from showing.
  if (product.value && currentUser.value) {
    axios
      .post(`${API_URL}/feed/interactions`, {
        user: currentUser.value._id,
        product: product.value._id,
        shop: product.value.shop?._id,
        type: 'view',
      })
      .catch((error) => console.log(error.message))
  }
})
</script>

<template>
  <p v-if="loading" class="text-muted">Loading...</p>
  <div v-else-if="loadError" class="alert alert-warning">
    {{ loadError }} <RouterLink to="/browse">Back to browse</RouterLink>
  </div>
  <div v-else-if="product" class="row g-4">
    <div class="col-md-5">
      <img :src="product.imageUrl || '/placeholder.svg'" class="img-fluid rounded" :alt="product.name"
        @error="$event.target.src = '/placeholder.svg'" />
    </div>
    <div class="col-md-7">
      <h2>{{ product.name }}</h2>
      <!-- the shop can be missing if it was deleted - don't crash the page -->
      <p v-if="product.shop" class="text-muted">
        by <RouterLink :to="`/shops/${product.shop._id}`">{{ product.shop.name }}</RouterLink>
        &middot; <StarRating :value="product.shop.stats.avgRating" />
        <span v-if="product.shop.nearestMrt"> &middot; {{ product.shop.nearestMrt }} MRT</span>
      </p>
      <div v-if="product.shop" class="mb-3">
        <FollowButton :shop="product.shop" />
      </div>
      <p v-else class="text-muted">This seller's shop is no longer available.</p>
      <p class="fs-4 fw-bold">{{ formatPrice(product.price) }} <span class="fs-6 text-muted fw-normal">/ {{ product.unit }}</span></p>
      <p>{{ product.description }}</p>

      <h6>Available slots</h6>
      <ul v-if="product.orderSlots">
        <li v-for="slot in product.orderSlots" :key="slot._id">{{ formatDateTime(slot.start) }}</li>
      </ul>
      <p v-if="!product.orderSlots || product.orderSlots.length === 0" class="text-muted">No slots listed - ask the seller.</p>

      <!-- <RouterLink v-if="currentUser && currentUser.role === 'buyer'" :to="`/order/new/${product._id}`" class="btn btn-brand">
        Request order
      </RouterLink>
      <p v-else-if="!currentUser" class="text-muted">
        <RouterLink to="/login">Log in</RouterLink> as a buyer to order.
      </p> -->
      <div v-if="currentUser && currentUser.role === 'buyer' && product.shop">
        <div class="d-flex gap-2">
          <RouterLink :to="`/order/new/${product._id}`" class="btn btn-brand">Request order</RouterLink>
          <button class="btn chatBtn" @click="chatWithSeller">Chat with seller</button>
        </div>
        <p v-if="chatError" class="text-danger small mt-2">{{ chatError }}</p>
      </div>
      <p v-else-if="!currentUser" class="text-muted">
        <RouterLink to="/login">Log in</RouterLink> as a buyer to order.
      </p>
    </div>
  </div>
</template>


<style scoped>
.chatBtn{
  color: #c2410c;
  border-color: #c2410c
}

.chatBtn:hover{
  color: #9a3412;
  border-color: #9a3412
}
</style>