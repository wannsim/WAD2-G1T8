<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import axios from 'axios'
import { API_URL } from '@/utils/config'
import { formatDateTime } from '@/utils/format'
import StarRating from './StarRating.vue'

// An empty productId shows all reviews; choosing a product filters locally.
const props = defineProps({
  shopId: { type: String, required: true },
  productId: { type: String, default: '' },
})
const reviews = ref([])
const loading = ref(false)
const error = ref('')
let controller

const visibleReviews = computed(() => props.productId
  ? reviews.value.filter((review) => String(review.product?._id || review.product) === props.productId)
  : reviews.value)
const averageRating = computed(() => visibleReviews.value.length
  ? (visibleReviews.value.reduce((sum, review) => sum + review.rating, 0) / visibleReviews.value.length).toFixed(1)
  : '')

async function load() {
  controller?.abort()
  reviews.value = []
  error.value = ''
  if (!props.shopId) {
    loading.value = false
    return
  }
  const request = new AbortController()
  controller = request
  loading.value = true
  try {
    const response = await axios.get(`${API_URL}/reviews/shop/${props.shopId}`, { signal: request.signal })
    if (!request.signal.aborted) reviews.value = response.data
  } catch (err) {
    if (!request.signal.aborted) error.value = 'Could not load reviews. Please try again.'
  } finally {
    if (controller === request) loading.value = false
  }
}

watch(() => props.shopId, load, { immediate: true })
onBeforeUnmount(() => controller?.abort())
</script>

<template>
  <div :aria-busy="loading">
    <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
      <p class="mb-0" aria-live="polite">
        <template v-if="!loading && !error">
          {{ visibleReviews.length }} {{ visibleReviews.length === 1 ? 'review' : 'reviews' }}
          <span v-if="averageRating" class="text-muted"> &middot; {{ averageRating }} / 5 average rating</span>
        </template>
      </p>
      <button type="button" class="btn btn-sm btn-outline-secondary" :disabled="loading" @click="load">Refresh reviews</button>
    </div>
    <p v-if="loading" class="text-muted" role="status">Loading reviews...</p>
    <div v-else-if="error" class="alert alert-warning" role="alert">
      {{ error }} <button type="button" class="btn btn-sm btn-outline-secondary" @click="load">Retry</button>
    </div>
    <p v-else-if="visibleReviews.length === 0" class="text-muted">
      {{ productId ? 'No reviews for this product yet.' : 'No reviews yet. Reviews appear after buyers review their completed orders.' }}
    </p>
    <template v-else>
      <article v-for="r in visibleReviews" :key="r._id" class="border-bottom py-3">
        <p class="mb-1 fw-semibold">
          <RouterLink v-if="r.product?._id" :to="`/products/${r.product._id}`">{{ r.product.name }}</RouterLink>
          <span v-else class="text-muted">Product no longer available</span>
        </p>
        <div class="d-flex align-items-center flex-wrap gap-2 mb-1">
          <span role="img" :aria-label="`${r.rating} out of 5 stars`"><StarRating :value="r.rating" /></span>
          <strong>{{ r.buyer?.name || 'Buyer' }}</strong>
          <span class="text-muted small">{{ formatDateTime(r.createdAt) }}</span>
        </div>
        <p v-if="r.comment" class="review-comment mb-0">{{ r.comment }}</p>
        <p v-else class="text-muted mb-0">No written comment.</p>
      </article>
    </template>
  </div>
</template>

<style scoped>
.review-comment {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
</style>
