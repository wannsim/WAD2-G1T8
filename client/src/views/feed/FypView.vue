<script setup>
import { ref, watch, onMounted } from 'vue'
import axios from 'axios'
import { API_URL } from '@/utils/config'
import { currentUser } from '@/utils/auth'

// Owner: Jessie - the home page with For You / Following (Trending to be added later) tabs
const TABS = [
  { key: 'foryou', label: 'For You' },
  { key: 'following', label: 'Following' },
]
const tab = ref('foryou')
const items = ref([]) // [{ product, reason, score }]
const loading = ref(false)

async function loadFeed() {
  loading.value = true
  const userId = currentUser.value ? currentUser.value._id : 'guest'
  try {
    const response = await axios.get(`${API_URL}/feed/${userId}`, { params: { tab: tab.value } })
    items.value = response.data
    logImpressions()
  } catch (error) {
    console.log(error.message)
    items.value = []
  } finally {
    loading.value = false
  }
}

// log one "impression" per product shown (logged-in buyers only)
function logImpressions() {
  if (!currentUser.value) return
  items.value.forEach((item) => {
    axios
      .post(`${API_URL}/feed/interactions`, {
        user: currentUser.value._id,
        product: item.product._id,
        shop: item.product.shop?._id,
        type: 'impression',
      })
      .catch(() => {})
  })
}

// clicking a card = a "click" signal (the detail page separately logs a "view")
function logClick(item) {
  if (!currentUser.value) return
  axios
    .post(`${API_URL}/feed/interactions`, {
      user: currentUser.value._id,
      product: item.product._id,
      shop: item.product.shop?._id,
      type: 'click',
    })
    .catch(() => {})
}

onMounted(loadFeed)
watch(tab, loadFeed)
</script>

<template>
  <div>
    <ul class="nav nav-pills mb-3">
      <li v-for="t in TABS" :key="t.key" class="nav-item">
        <button class="nav-link" :class="{ active: tab === t.key }" @click="tab = t.key">{{ t.label }}</button>
      </li>
    </ul>

    <p v-if="tab === 'foryou' && !currentUser" class="text-muted">Log in to get recommendations that match your interests.</p>
    <p v-if="tab === 'following' && !currentUser" class="text-muted">Log in and follow shops to see them here.</p>

    <p v-if="loading" class="text-muted">Loading...</p>
    <p v-else-if="items.length === 0" class="text-muted">Nothing here yet.</p>

    <div class="row g-3">
      <div v-for="item in items" :key="item.product._id" class="col-sm-6 col-lg-3">
        <ProductCard :product="item.product" :reason="item.reason" favourite @open="logClick(item)" />
      </div>
    </div>
  </div>
</template>
