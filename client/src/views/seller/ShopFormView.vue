<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'
import { API_URL } from '@/utils/config'
import { currentUser } from '@/utils/auth'
import { approximateLocation } from '@/utils/geo'

// Owner: Cheyenne - create / edit the seller's business profile
const router = useRouter()
const shopId = ref(null) // null = creating a new shop
const shop = ref({
  name: '',
  description: '',
  address: '',
  postalCode: '',
  nearestMrt: '',
  pickup: true,
  delivery: false,
  location: { lat: null, lng: null },
})
const message = ref('')

onMounted(async () => {
  if (!currentUser.value || currentUser.value.role !== 'seller') {
    router.push('/login')
    return
  }
  try {
    const response = await axios.get(`${API_URL}/shops/mine/${currentUser.value._id}`)
    if (response.data) {
      shopId.value = response.data._id
      shop.value = { ...shop.value, ...response.data }
      if (!shop.value.location) shop.value.location = { lat: null, lng: null }
    }
  } catch (error) {
    message.value = error.message
  }
})

// OpenStreetMap Nominatim: postal code -> coordinates (rounded so the exact home is not revealed)
async function findLocation() {
  try {
    const response = await axios.get('https://nominatim.openstreetmap.org/search', {
      params: { q: `${shop.value.postalCode || shop.value.address}, Singapore`, format: 'json', limit: 1 },
    })
    if (response.data.length === 0) {
      message.value = 'Could not find that address. Check the postal code.'
      return
    }
    const place = response.data[0]
    shop.value.location = approximateLocation(parseFloat(place.lat), parseFloat(place.lon))
    message.value = 'Location found!'
  } catch (error) {
    message.value = error.message
  }
}

async function save() {
  try {
    if (shopId.value) {
      await axios.put(`${API_URL}/shops/${shopId.value}`, shop.value)
    } else {
      const response = await axios.post(`${API_URL}/shops`, { ...shop.value, owner: currentUser.value._id })
      shopId.value = response.data._id
    }
    message.value = 'Shop saved!'
  } catch (error) {
    message.value = error.response?.data?.message || error.message
  }
}
</script>

<template>
  <div class="row justify-content-center">
    <div class="col-md-7">
      <h2 class="mb-3">{{ shopId ? 'Edit my shop' : 'Create my shop' }}</h2>
      <div v-if="message" class="alert alert-info">{{ message }}</div>

      <div class="mb-3">
        <label class="form-label">Shop name</label>
        <input type="text" class="form-control" v-model.trim="shop.name" />
      </div>
      <div class="mb-3">
        <label class="form-label">Description</label>
        <textarea class="form-control" rows="3" v-model="shop.description"></textarea>
      </div>
      <div class="row">
        <div class="col-md-6 mb-3">
          <label class="form-label">Postal code</label>
          <input type="text" class="form-control" v-model.trim="shop.postalCode" />
        </div>
        <div class="col-md-6 mb-3">
          <label class="form-label">Nearest MRT</label>
          <input type="text" class="form-control" v-model.trim="shop.nearestMrt" />
        </div>
      </div>
      <div class="mb-3">
        <label class="form-label">Address (private - not shown to buyers)</label>
        <input type="text" class="form-control" v-model.trim="shop.address" />
      </div>

      <div class="mb-3">
        <button class="btn btn-outline-secondary btn-sm" @click="findLocation">Find map location</button>
        <span v-if="shop.location && shop.location.lat" class="ms-2 text-muted small">
          Pin: {{ shop.location.lat }}, {{ shop.location.lng }}
        </span>
      </div>

      <div class="form-check">
        <input class="form-check-input" type="checkbox" id="pickup" v-model="shop.pickup" />
        <label class="form-check-label" for="pickup">Self-pickup available</label>
      </div>
      <div class="form-check mb-3">
        <input class="form-check-input" type="checkbox" id="delivery" v-model="shop.delivery" />
        <label class="form-check-label" for="delivery">Delivery available</label>
      </div>

      <button class="btn btn-brand" @click="save">Save shop</button>
    </div>
  </div>
</template>
