<script setup>
import { ref, onMounted } from 'vue'
import axios from 'axios'
import { API_URL } from '@/utils/config'
import { formatDateTime } from '@/utils/format'

// Owner: Yu Chen.  Used on the shop page:  <ReviewList :shop-id="shop._id" />
const props = defineProps({ shopId: String })
const reviews = ref([])

onMounted(async () => {
  try {
    const response = await axios.get(`${API_URL}/reviews/shop/${props.shopId}`)
    reviews.value = response.data
  } catch (error) {
    console.log(error.message)
  }
})
</script>

<template>
  <div>
    <h4 class="mb-3">Reviews ({{ reviews.length }})</h4>
    <p v-if="reviews.length === 0" class="text-muted">No reviews yet.</p>
    <div v-for="r in reviews" :key="r._id" class="border-bottom py-2">
      <StarRating :value="r.rating" />
      <strong class="ms-2">{{ r.buyer?.name }}</strong>
      <span class="text-muted small ms-2">{{ formatDateTime(r.createdAt) }}</span>
      <p class="mb-0">{{ r.comment }}</p>
    </div>
  </div>
</template>
