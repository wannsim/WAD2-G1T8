<script setup>
import { ref, watch } from 'vue'
import axios from 'axios'
import { API_URL } from '@/utils/config'
import ReviewBoard from './ReviewBoard.vue'

// Owner: Cheyenne
// "Product ratings" on the product page: total, average, and the reviews as cards
// (filter by stars, sort, pages - all in ReviewBoard). No star bars here; the shop page has those.
//   <ProductReviews :product-id="product._id" />
const props = defineProps({ productId: { type: String, required: true } })

const reviews = ref([])
const loading = ref(true)
const error = ref('')

async function load() {
  loading.value = true
  error.value = ''
  try {
    const res = await axios.get(`${API_URL}/reviews/product/${props.productId}`)
    reviews.value = res.data
  } catch (err) {
    error.value = 'Could not load reviews. Please try again.'
  } finally {
    loading.value = false
  }
}
watch(() => props.productId, load, { immediate: true })
</script>

<template>
  <section class="card" aria-labelledby="ratings-title">
    <div class="card-body p-4">
      <h4 id="ratings-title" class="mb-4">Product ratings</h4>

      <p v-if="loading" class="text-muted mb-0">Loading reviews...</p>
      <div v-else-if="error" class="alert alert-warning mb-0">
        {{ error }} <button type="button" class="btn btn-sm btn-outline-secondary ms-2" @click="load">Retry</button>
      </div>
      <p v-else-if="reviews.length === 0" class="text-muted mb-0">No reviews yet. Buyers can review after their order is completed.</p>
      <ReviewBoard v-else :reviews="reviews" hide-breakdown />
    </div>
  </section>
</template>
