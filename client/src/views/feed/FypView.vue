<script setup>
import { ref, onMounted } from 'vue'
import axios from 'axios'
import { API_URL } from '@/utils/config'
import { currentUser } from '@/utils/auth'

// Owner: Member 4 - the "For You" home page
const items = ref([]) // [{ product, reason, score }]

onMounted(async () => {
  const userId = currentUser.value ? currentUser.value._id : 'guest'
  try {
    const response = await axios.get(`${API_URL}/feed/${userId}`)
    items.value = response.data
  } catch (error) {
    console.log(error.message)
  }
})

// TODO (Member 4): send "impression" interactions for the products shown here
</script>

<template>
  <div>
    <h2 class="mb-1">For you</h2>
    <p class="text-muted">
      <span v-if="currentUser">Picked for you, {{ currentUser.name }}.</span>
      <span v-else>Log in to get recommendations that match your interests.</span>
    </p>

    <p v-if="items.length === 0" class="text-muted">Nothing here yet.</p>

    <div class="row g-3">
      <div v-for="item in items" :key="item.product._id" class="col-sm-6 col-lg-3">
        <ProductCard :product="item.product" :reason="item.reason" />
      </div>
    </div>
  </div>
</template>
