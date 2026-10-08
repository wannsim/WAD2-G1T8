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

onMounted(() => {
  if (!currentUser.value) router.push('/login')
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
    <div class="col-md-6">
      <h2 class="mb-3">Leave a review</h2>
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
