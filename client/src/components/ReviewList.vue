<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import axios from 'axios'
import { API_URL } from '@/utils/config'
import ReviewBoard from './ReviewBoard.vue'

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
    <p v-if="loading" class="text-muted" role="status">Loading reviews...</p>
    <div v-else-if="error" class="alert alert-warning" role="alert">
      {{ error }} <button type="button" class="btn btn-sm btn-outline-secondary" @click="load">Retry</button>
    </div>
    <p v-else-if="visibleReviews.length === 0" class="text-muted">
      {{ productId ? 'No reviews for this product yet.' : 'No reviews yet. Reviews appear after buyers review their completed orders.' }}
    </p>
    <ReviewBoard v-else :reviews="visibleReviews" show-product />
  </div>
</template>
