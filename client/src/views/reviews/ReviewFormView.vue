<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import axios from 'axios'
import { API_URL } from '@/utils/config'
import { currentUser } from '@/utils/auth'

// Owner: Yu Chen - /review/:orderId  (buyer reviews a completed order)
const route = useRoute()
const router = useRouter()
const rating = ref(5)
const comment = ref('')
const error = ref('')
const order = ref(null) // the order being reviewed (shows which product), from GET /orders/buyer/:userId

onMounted(async () => {
  if (!currentUser.value) return router.push('/login')
  try {
    const res = await axios.get(`${API_URL}/orders/buyer/${currentUser.value._id}`)
    order.value = res.data.find((o) => o._id === route.params.orderId) || null
  } catch (err) {
    // the form still works without the product name
  }
})

async function submitReview() {
  error.value = ''
  try {
    await axios.post(`${API_URL}/reviews`, {
      order: route.params.orderId,
      buyer: currentUser.value._id,
      rating: rating.value,
      comment: comment.value,
    })
    router.push('/orders')
  } catch (err) {
    error.value = err.response?.data?.message || err.message
  }
}
</script>

<template>
  <div class="row justify-content-center">
    <div class="col-12 page-narrow">
      <h2 class="page-title">Leave a review</h2>
      <div v-if="order" class="card p-3 mb-3 bg-light">
        <div class="small text-muted">You are reviewing</div>
        <div class="fw-semibold">{{ order.product ? order.product.name : 'Product removed' }} x {{ order.quantity }}</div>
        <div v-if="order.shop" class="small text-muted">from {{ order.shop.name }}</div>
      </div>
      <div v-if="order && order.reviewed" class="alert alert-info">You already reviewed this order. Thank you!</div>
      <div v-if="error" class="alert alert-danger">{{ error }}</div>

      <div class="mb-3">
        <label class="form-label d-block">Your rating</label>
        <StarRating :value="rating" editable @rate="rating = $event" />
      </div>
      <div class="mb-3">
        <label class="form-label">Comment</label>
        <textarea class="form-control" rows="4" v-model="comment"></textarea>
      </div>
      <button class="btn btn-brand" @click="submitReview">Submit review</button>
    </div>
  </div>
</template>
