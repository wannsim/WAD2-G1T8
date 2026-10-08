<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'
import { API_URL } from '@/utils/config'
import { currentUser } from '@/utils/auth'

// Owner: Member 3
const router = useRouter()
const favourites = ref([])

async function load() {
  try {
    const response = await axios.get(`${API_URL}/favourites/${currentUser.value._id}`)
    favourites.value = response.data
  } catch (error) {
    console.log(error.message)
  }
}

async function remove(fav) {
  try {
    await axios.post(`${API_URL}/favourites`, { user: currentUser.value._id, product: fav.product._id }) // toggles off
    favourites.value = favourites.value.filter((f) => f._id !== fav._id)
  } catch (error) {
    console.log(error.message)
  }
}

onMounted(() => {
  if (!currentUser.value) {
    router.push('/login')
    return
  }
  load()
})
</script>

<template>
  <div>
    <h2 class="mb-3">My favourites</h2>
    <p v-if="favourites.length === 0" class="text-muted">Nothing saved yet. Tap the heart on a product!</p>
    <div class="row g-3">
      <div v-for="fav in favourites" :key="fav._id" class="col-sm-6 col-lg-3">
        <ProductCard :product="fav.product">
          <button class="btn btn-sm btn-outline-secondary" @click="remove(fav)">Remove</button>
        </ProductCard>
      </div>
    </div>
  </div>
</template>
