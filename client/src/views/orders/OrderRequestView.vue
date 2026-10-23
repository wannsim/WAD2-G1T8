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
const submitting = ref(false)
const sent = ref(false)
const chatBusy = ref(false)
const chatError = ref('')

const total = computed(() => (product.value ? product.value.price * quantity.value : 0))

// Keeps only slots that start in the future.
const futureSlots = computed(() => {
  const slots = []
  if (!product.value) return slots
  const now = new Date().getTime()
  for (let i = 0; i < product.value.orderSlots.length; i++) {
    const slot = product.value.orderSlots[i]
    if (new Date(slot.start).getTime() > now) { // Only future slots may be chosen.
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
    if (!product.value.shop.pickup && product.value.shop.delivery) { // Use an option the shop offers.
      fulfilment.value = 'delivery'
    }
    loading.value = false
  } catch (err) {
    loadError.value = 'We could not load this product. Please go back and try again.' // Failed loads must show a message.
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

// Uses the server's error message, or a general message if none is available.
function getErrorMessage(err) {
  if (err.response && err.response.data && err.response.data.message) {
    return err.response.data.message
  }
  return 'Something went wrong. Please try again.'
}

// Opens the buyer's chat with this product's seller.
async function messageSeller() {
  if (chatBusy.value) return // Ignore another chat click while the request is being sent.
  chatError.value = ''
  chatBusy.value = true
  try {
    const response = await axios.post(`${API_URL}/chats/start`, {
      buyer: currentUser.value._id,
      shop: product.value.shop._id,
    })
    router.push('/chats/' + response.data._id)
    chatBusy.value = false
  } catch (err) {
    chatError.value = getErrorMessage(err)
    chatBusy.value = false
  }
}

// Returns the first problem with the form, or an empty string if it is valid.
function validateForm() {
  if (!Number.isInteger(quantity.value) || quantity.value < 1) return 'Quantity must be a whole number, 1 or more.' // Quantity must be a positive whole number.
  if (!requestedTime.value) return 'Please choose a pickup time.' // An order needs a time.
  if (fulfilment.value !== 'pickup' && fulfilment.value !== 'delivery') return 'Choose pickup or delivery.' // Use one of the two fulfilment options.
  return ''
}

// Checks the form and sends one request, then shows its result on this page.
async function submitOrder() {
  if (submitting.value) return // Ignore another click while the request is being sent.
  error.value = ''
  const message = validateForm()
  if (message) { // Show the first problem without sending a request.
    error.value = message
    return
  }
  submitting.value = true
  try {
    await axios.post(`${API_URL}/orders`, {
      buyer: currentUser.value._id,
      product: product.value._id,
      quantity: quantity.value,
      customisation: customisation.value,
      fulfilment: fulfilment.value,
      requestedTime: requestedTime.value,
    })
    sent.value = true
    submitting.value = false
  } catch (err) {
    error.value = getErrorMessage(err)
    submitting.value = false
  }
}
</script>

<template>
  <div class="row justify-content-center">
    <div class="col-12 page-narrow">
      <p v-if="loading" data-testid="order-loading">
        <span class="spinner-border spinner-border-sm"></span> Loading...
      </p>
      <div v-else-if="loadError" class="alert alert-danger" data-testid="order-load-error">{{ loadError }}</div>
      <div v-else-if="sent && product" class="alert alert-success" data-testid="order-success">
        <p>Request sent to {{ product.shop.name }}. The seller will accept, decline or suggest another time.</p>
        <div class="d-flex flex-wrap gap-2">
          <RouterLink to="/orders" class="btn btn-brand" data-testid="order-view-orders-link">View my orders</RouterLink>
        </div>
      </div>
      <div v-else-if="product && product.isAvailable === false" class="alert alert-warning" data-testid="order-unavailable">
        This product is not available right now.
      </div>
      <div v-else-if="futureSlots.length === 0" class="alert alert-info" data-testid="order-no-slots">
        <p class="mb-2">No upcoming slots for this product.</p>
        <div v-if="currentUser && currentUser.role === 'buyer'">
          <div class="d-flex flex-wrap gap-2">
            <button type="button" class="btn btn-sm btn-outline-secondary" :disabled="chatBusy" @click="messageSeller" data-testid="order-message-seller">Message seller</button>
          </div>
          <p v-if="chatError" class="text-danger small mt-2 mb-0" data-testid="order-chat-error">{{ chatError }}</p>
        </div>
      </div>
      <div v-else-if="product" data-testid="order-form">
        <h2 class="page-title">Request: {{ product.name }}</h2>
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
          <div v-if="currentUser && currentUser.role === 'buyer'" class="small mt-2">
            <div class="d-flex flex-wrap gap-2">
              <span>None of these times work?</span>
              <button type="button" class="btn btn-link btn-sm p-0" :disabled="chatBusy" @click="messageSeller" data-testid="order-message-seller">Message seller</button>
            </div>
            <p v-if="chatError" class="text-danger small mt-2 mb-0" data-testid="order-chat-error">{{ chatError }}</p>
          </div>
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
          <button class="btn btn-brand" :disabled="submitting" @click="submitOrder" data-testid="order-submit">
            <template v-if="submitting">
              <span class="spinner-border spinner-border-sm"></span> Sending...
            </template>
            <template v-else>Send request</template>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
