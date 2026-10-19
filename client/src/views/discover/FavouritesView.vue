<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'
import { API_URL } from '@/utils/config'
import { currentUser } from '@/utils/auth'
import { savedIds, loadSavedIds } from '@/utils/favourites'

// Owner: Member 3
const router = useRouter()
const favourites = ref([])
const loading = ref(true)

// same shared saved list as the ♥ on For You / Browse, so un-liking anywhere
// (including the ♥ on these cards) drops the card from this page straight away
const visible = computed(() => favourites.value.filter((fav) => fav.product && savedIds.value.includes(fav.product._id)))

async function load() {
  try {
    const response = await axios.get(`${API_URL}/favourites/${currentUser.value._id}`)
    favourites.value = response.data
    // these are definitely saved - make sure the shared list knows, even before it has loaded
    response.data.forEach((fav) => {
      if (fav.product && !savedIds.value.includes(fav.product._id)) savedIds.value.push(fav.product._id)
    })
  } catch (error) {
    console.log(error.message)
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  if (!currentUser.value) {
    router.push('/login')
    return
  }
  await loadSavedIds()
  load()
})
</script>

<template>
  <div>
    <h2 class="mb-3">My favourites</h2>
    <p v-if="loading" class="text-muted">Loading...</p>
    <p v-else-if="visible.length === 0" class="text-muted">Nothing saved yet. Tap the heart on a product!</p>
    <div class="row g-3">
      <div v-for="fav in visible" :key="fav._id" class="col-sm-6 col-lg-3">
        <ProductCard :product="fav.product" favourite />
      </div>
    </div>
  </div>
</template>
