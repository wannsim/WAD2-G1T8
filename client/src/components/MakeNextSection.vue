<script setup>
// Owner: Wan Sim
// Loads what the "What to make next" panel needs from the server (GET /forecast/make-next/:shopId, read only)
// and passes it on. MakeNextPanel itself only takes props, so its tests need no server and no mocking.
import { ref, watch } from 'vue'
import axios from 'axios'
import { API_URL } from '@/utils/config'
import MakeNextPanel from './MakeNextPanel.vue'

const props = defineProps({
  shopId: { type: String, required: true },
  orders: { type: Array, default: () => [] },
})

const data = ref({ categories: {}, trends: [], trendsAvailable: false })
const status = ref('loading')

async function load() {
  status.value = 'loading'
  try {
    const response = await axios.get(`${API_URL}/forecast/make-next/${props.shopId}`)
    data.value = response.data
    status.value = 'ready'
  } catch {
    status.value = 'error'
  }
}

watch(() => props.shopId, load, { immediate: true })
</script>

<template>
  <MakeNextPanel :orders="orders" :category-of="data.categories" :trends="data.trends"
    :trends-available="data.trendsAvailable" :status="status" />
</template>
