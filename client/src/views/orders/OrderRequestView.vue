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
const loading = ref(true)
const loadError = ref('')

const total = computed(() => (product.value ? product.value.price * quantity.value : 0))

// Keeps only slots that start in the future.
const futureSlots = computed(() => {
  const slots = []
  if (!product.value) return slots
  const now = new Date().getTime()
  for (let i = 0; i < product.value.orderSlots.length; i++) {
    const slot = product.value.orderSlots[i]
    if (new Date(slot.start).getTime() > now) { // R7: only future slots may be chosen.
      slots.push(slot)
    }
  }
  return slots
})

// Loads the product and chooses delivery when pickup is not offered.
async function loadProduct() {
  try {
    const response = await axios.get(`${API_URL}/products/${route.params.productId}`)
    product.value = response.data
    if (!product.value.shop.pickup && product.value.shop.delivery) { // OPEN #8: use an option the shop offers.
      fulfilment.value = 'delivery'
    }
    loading.value = false
  } catch (err) {
    loadError.value = 'We could not load this product. Please go back and try again.' // R12: failed loads must show a message.
    loading.value = false
  }
}

// Checks the login before loading the product.
onMounted(() => {
  if (!currentUser.value) {
    router.push('/login')
    return
  }
  loadProduct()
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
  <div class="row justify-content-center">
    <div class="col-12 col-md-8 col-lg-6">
      <p v-if="loading" data-testid="order-loading">
        <span class="spinner-border spinner-border-sm"></span> Loading...
      </p>
      <div v-else-if="loadError" class="alert alert-danger" data-testid="order-load-error">{{ loadError }}</div>
      <div v-else-if="product && product.isAvailable === false" class="alert alert-warning" data-testid="order-unavailable">
        This product is not available right now.
      </div>
      <div v-else-if="futureSlots.length === 0" class="alert alert-info" data-testid="order-no-slots">
        No upcoming slots for this product.
      </div>
      <div v-else-if="product" data-testid="order-form">
        <h2>Request: {{ product.name }}</h2>
        <p class="text-muted">from {{ product.shop.name }} &middot; {{ formatPrice(product.price) }} / {{ product.unit }}</p>
        <div v-if="error" class="alert alert-danger" data-testid="order-error">{{ error }}</div>

        <div class="mb-3">
          <label class="form-label" for="quantity">Quantity</label>
          <input type="number" min="1" class="form-control" id="quantity" v-model.number="quantity" data-testid="order-quantity" />
        </div>

        <div v-if="product.customisable" class="mb-3">
          <label class="form-label" for="customisation">Customisation (flavour, message, colours...)</label>
          <textarea class="form-control" rows="2" maxlength="200" id="customisation" v-model.trim="customisation" data-testid="order-customisation"></textarea>
        </div>

        <div class="mb-3">
          <label class="form-label" for="requested-time">Preferred time</label>
          <select class="form-select" id="requested-time" v-model="requestedTime" data-testid="order-time">
            <option disabled value="">Please select one</option>
            <option v-for="slot in futureSlots" :key="slot._id" :value="slot.start">
              {{ formatDateTime(slot.start) }}
            </option>
          </select>
        </div>

        <div class="mb-3">
          <div v-if="product.shop.pickup" class="form-check">
            <input class="form-check-input" type="radio" id="pickup" value="pickup" v-model="fulfilment" data-testid="order-fulfilment-pickup" />
            <label class="form-label form-check-label" for="pickup">Pickup</label>
          </div>
          <div v-if="product.shop.delivery" class="form-check">
            <input class="form-check-input" type="radio" id="delivery" value="delivery" v-model="fulfilment" data-testid="order-fulfilment-delivery" />
            <label class="form-label form-check-label" for="delivery">Delivery</label>
          </div>
        </div>

        <p class="fw-bold" data-testid="order-total">Total: {{ formatPrice(total) }}</p>
        <div class="d-flex flex-wrap gap-2">
          <button class="btn btn-brand" @click="submitOrder" data-testid="order-submit">Send request</button>
        </div>
      </div>
    </div>
  </div>
</template>
