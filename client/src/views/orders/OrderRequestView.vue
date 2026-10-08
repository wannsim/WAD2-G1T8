<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import axios from 'axios'
import { API_URL } from '@/utils/config'
import { currentUser } from '@/utils/auth'
import { formatPrice, formatDateTime } from '@/utils/format'

// Owner: Basile - buyer sends an order REQUEST (/order/new/:productId)
const route = useRoute()
const router = useRouter()
const product = ref(null)
const quantity = ref(1)
const customisation = ref('')
const fulfilment = ref('pickup')
const requestedTime = ref('')
const error = ref('')

const total = computed(() => (product.value ? product.value.price * quantity.value : 0))

onMounted(async () => {
  if (!currentUser.value) {
    router.push('/login')
    return
  }
  try {
    const response = await axios.get(`${API_URL}/products/${route.params.productId}`)
    product.value = response.data
  } catch (err) {
    error.value = err.message
  }
})

async function submitOrder() {
  error.value = ''
  try {
    await axios.post(`${API_URL}/orders`, {
      buyer: currentUser.value._id,
      product: product.value._id,
      quantity: quantity.value,
      customisation: customisation.value,
      fulfilment: fulfilment.value,
      requestedTime: requestedTime.value,
    })
    router.push('/orders')
  } catch (err) {
    error.value = err.response?.data?.message || err.message
  }
}
</script>

<template>
  <div v-if="product" class="row justify-content-center">
    <div class="col-md-6">
      <h2>Request: {{ product.name }}</h2>
      <p class="text-muted">from {{ product.shop.name }} &middot; {{ formatPrice(product.price) }} / {{ product.unit }}</p>
      <div v-if="error" class="alert alert-danger">{{ error }}</div>

      <div class="mb-3">
        <label class="form-label">Quantity</label>
        <input type="number" min="1" class="form-control" v-model.number="quantity" />
      </div>

      <div v-if="product.customisable" class="mb-3">
        <label class="form-label">Customisation (flavour, message, colours...)</label>
        <textarea class="form-control" rows="2" v-model="customisation"></textarea>
      </div>

      <div class="mb-3">
        <label class="form-label">Preferred time</label>
        <select class="form-select" v-model="requestedTime">
          <option disabled value="">Please select one</option>
          <option v-for="slot in product.orderSlots" :key="slot._id" :value="slot.start">
            {{ formatDateTime(slot.start) }}
          </option>
        </select>
      </div>

      <div class="mb-3">
        <div class="form-check">
          <input class="form-check-input" type="radio" id="pickup" value="pickup" v-model="fulfilment" />
          <label class="form-check-label" for="pickup">Pickup</label>
        </div>
        <div v-if="product.shop.delivery" class="form-check">
          <input class="form-check-input" type="radio" id="delivery" value="delivery" v-model="fulfilment" />
          <label class="form-check-label" for="delivery">Delivery</label>
        </div>
      </div>

      <p class="fw-bold">Total: {{ formatPrice(total) }}</p>
      <button class="btn btn-brand" @click="submitOrder">Send request</button>
    </div>
  </div>
</template>
