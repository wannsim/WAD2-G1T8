<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'
import { API_URL } from '@/utils/config'
import { currentUser } from '@/utils/auth'
import { ORDER_STATUS_BADGE } from '@/utils/constants'
import { formatPrice, formatDateTime, capitalize } from '@/utils/format'

// Owner: Basile - buyer's order dashboard
const router = useRouter()
const orders = ref([])
const loading = ref(true)
const error = ref('')
const activeTab = ref('pending')
const message = ref('')
const busyId = ref('')
const confirmId = ref('')
const chatBusyId = ref('')
const chatError = ref('')

// Groups orders that are waiting for a reply or a new time to be accepted.
const pendingOrders = computed(() => {
  const groupedOrders = []
  for (let i = 0; i < orders.value.length; i++) {
    const order = orders.value[i]
    if (order.status === 'pending' || order.status === 'rescheduled') { // Pending includes pending and rescheduled.
      groupedOrders.push(order)
    }
  }
  return groupedOrders
})

// Groups accepted orders for the Accepted tab.
const upcomingOrders = computed(() => {
  const groupedOrders = []
  for (let i = 0; i < orders.value.length; i++) {
    const order = orders.value[i]
    if (order.status === 'accepted') { // Upcoming includes accepted orders.
      groupedOrders.push(order)
    }
  }
  return groupedOrders
})

// Groups completed orders for the Completed tab.
const completedOrders = computed(() => {
  const groupedOrders = []
  for (let i = 0; i < orders.value.length; i++) {
    const order = orders.value[i]
    if (order.status === 'completed') { // Completed includes completed orders.
      groupedOrders.push(order)
    }
  }
  return groupedOrders
})

// Groups declined and cancelled orders for the Past tab.
const pastOrders = computed(() => {
  const groupedOrders = []
  for (let i = 0; i < orders.value.length; i++) {
    const order = orders.value[i]
    if (order.status === 'declined' || order.status === 'cancelled') { // Past includes declined and cancelled.
      groupedOrders.push(order)
    }
  }
  return groupedOrders
})

// Chooses the group shown by the active tab.
const visibleOrders = computed(() => {
  if (activeTab.value === 'pending') {
    return pendingOrders.value
  } else if (activeTab.value === 'upcoming') {
    return upcomingOrders.value
  } else if (activeTab.value === 'completed') {
    return completedOrders.value
  } else {
    return pastOrders.value
  }
})

// Checks whether an accepted order's requested time has passed.
function isOverdue(order) {
  return order.status === 'accepted' && new Date(order.requestedTime).getTime() < new Date().getTime() // Only accepted orders with a past time are overdue.
}

// Uses the server's error message, or a general message if none is available.
function getErrorMessage(err) {
  if (err.response && err.response.data && err.response.data.message) {
    return err.response.data.message
  }
  return 'Something went wrong. Please try again.'
}

// Opens the buyer's chat with this order's shop.
async function messageSeller(order) {
  if (chatBusyId.value !== '') return // Ignore another chat click while a request is being sent.
  chatError.value = ''
  chatBusyId.value = order._id
  try {
    const response = await axios.post(`${API_URL}/chats/start`, {
      buyer: currentUser.value._id,
      shop: order.shop._id,
    })
    router.push('/chats/' + response.data._id)
    chatBusyId.value = ''
  } catch (err) {
    chatError.value = getErrorMessage(err)
    chatBusyId.value = ''
  }
}

// Loads the buyer's orders and finishes the initial loading state.
async function loadOrders() {
  try {
    const response = await axios.get(`${API_URL}/orders/buyer/${currentUser.value._id}`)
    orders.value = response.data
    loading.value = false
  } catch (err) {
    error.value = getErrorMessage(err)
    loading.value = false
  }
}

// Shows the cancellation confirmation for this order.
function askConfirm(order) {
  confirmId.value = order._id
}

// Closes the cancellation confirmation without changing an order.
function clearConfirm() {
  confirmId.value = ''
}

// Changes one order at a time, shows the result and refreshes the list.
async function updateStatus(order, status) {
  if (busyId.value !== '') return // Ignore another action while a request is being sent.
  message.value = ''
  error.value = ''
  busyId.value = order._id
  try {
    await axios.put(`${API_URL}/orders/${order._id}/status`, { status, userId: currentUser.value._id })
    if (status === 'cancelled') message.value = 'Order cancelled.' // Explain the successful cancellation.
    if (status === 'accepted') message.value = 'New time accepted.' // Explain the accepted proposal.
    confirmId.value = ''
    busyId.value = ''
    await loadOrders()
  } catch (err) {
    error.value = getErrorMessage(err)
    confirmId.value = ''
    busyId.value = ''
    await loadOrders()
  }
}

// Sends logged-out users to login and sellers to their dashboard before loading.
onMounted(() => {
  if (!currentUser.value) {
    router.push('/login')
    return
  }
  if (currentUser.value.role === 'seller') {
    router.push('/seller/orders')
    return
  }
  loadOrders()
})
</script>

<template>
  <div class="row">
    <div class="col-12">
      <h2 class="page-title">My orders</h2>
      <p v-if="loading" data-testid="buyer-orders-loading">
        <span class="spinner-border spinner-border-sm"></span> Loading...
      </p>
      <div v-else-if="error && orders.length === 0" class="alert alert-danger" data-testid="buyer-orders-error">{{ error }}</div>
      <div v-else-if="orders.length === 0" data-testid="buyer-orders-empty">
        <p class="text-muted">No orders yet.</p>
        <RouterLink to="/browse">Browse products</RouterLink>
      </div>
      <template v-else>
        <div v-if="message" class="alert alert-success" data-testid="buyer-orders-message">{{ message }}</div>
        <div v-if="error" class="alert alert-danger" data-testid="buyer-orders-error">{{ error }}</div>
        <div v-if="chatError" class="alert alert-danger" data-testid="order-chat-error">{{ chatError }}</div>
        <ul class="nav nav-pills mb-3" data-testid="buyer-orders-tabs">
          <li class="nav-item">
            <button class="nav-link" :class="{ active: activeTab === 'pending' }" @click="activeTab = 'pending'" data-testid="tab-pending">Pending ({{ pendingOrders.length }})</button>
          </li>
          <li class="nav-item">
            <button class="nav-link" :class="{ active: activeTab === 'upcoming' }" @click="activeTab = 'upcoming'" data-testid="tab-upcoming">Accepted ({{ upcomingOrders.length }})</button>
          </li>
          <li class="nav-item">
            <button class="nav-link" :class="{ active: activeTab === 'completed' }" @click="activeTab = 'completed'" data-testid="tab-completed">Completed ({{ completedOrders.length }})</button>
          </li>
          <li class="nav-item">
            <button class="nav-link" :class="{ active: activeTab === 'past' }" @click="activeTab = 'past'" data-testid="tab-past">Past ({{ pastOrders.length }})</button>
          </li>
        </ul>

        <div v-if="visibleOrders.length === 0" class="text-muted" data-testid="buyer-orders-tab-empty">
          <p v-if="activeTab === 'pending'">No orders waiting for the seller.</p>
          <p v-else-if="activeTab === 'upcoming'">No accepted orders yet.</p>
          <p v-else-if="activeTab === 'completed'">No completed orders yet.</p>
          <p v-else>No declined or cancelled orders.</p>
        </div>

        <!-- every card is the same size: grid rows all match the tallest card -->
        <div v-else class="list-grid">
          <div v-for="o in visibleOrders" :key="o._id">
            <div class="card h-100" data-testid="order-row">
              <div class="card-body d-flex flex-column">
                <div class="d-flex justify-content-between flex-wrap gap-2">
                  <h5>{{ o.product ? o.product.name : 'Product removed' }} x {{ o.quantity }}</h5>
                  <div class="d-flex flex-wrap gap-2 align-self-start">
                    <span class="badge align-self-start" :class="ORDER_STATUS_BADGE[o.status]" data-testid="order-status">{{ capitalize(o.status) }}</span>
                    <span v-if="isOverdue(o)" class="badge bg-danger" data-testid="order-overdue">Overdue</span>
                  </div>
                </div>
                <p class="mb-1 text-muted">{{ o.shop ? o.shop.name : 'Shop removed' }} &middot; {{ capitalize(o.fulfilment) }} &middot; {{ formatPrice(o.totalPrice) }}</p>
                <p class="mb-1">Time: {{ formatDateTime(o.requestedTime) }}</p>
                <p v-if="o.customisation" class="mb-1">Note: {{ o.customisation }}</p>

                <!-- The server enforces privacy; this check only decides what to display. -->
                <div v-if="o.fulfilment === 'pickup' && (o.status === 'accepted' || o.status === 'completed')" class="mb-2" data-testid="order-pickup-details">
                  <p v-if="o.pickupAddress" class="mb-1">Pickup address: {{ o.pickupAddress }}</p>
                  <p v-if="o.pickupPostalCode" class="mb-1">Postal code: {{ o.pickupPostalCode }}</p>
                  <p v-if="!o.pickupAddress && !o.pickupPostalCode" class="mb-1">The seller has not added an address yet.</p>
                </div>

                <div v-if="o.status === 'rescheduled'" class="alert alert-info py-2 mb-2" data-testid="order-proposal">
                  Seller suggests a new time: <strong>{{ formatDateTime(o.proposedTime) }}</strong>
                </div>

                <!-- buttons sit at the bottom of every card, so they line up -->
                <div class="mt-auto pt-2">
                <div v-if="o.status === 'pending' || o.status === 'rescheduled' || o.status === 'accepted'">
                  <template v-if="confirmId === o._id">
                    <p class="mb-1">Cancel this order?</p>
                    <div class="d-flex flex-wrap gap-2">
                      <button class="btn btn-sm btn-outline-danger" :disabled="busyId !== ''" @click="updateStatus(o, 'cancelled')" data-testid="order-confirm-yes">Yes, cancel</button>
                      <button class="btn btn-sm btn-outline-secondary" :disabled="busyId !== ''" @click="clearConfirm" data-testid="order-confirm-no">Keep order</button>
                    </div>
                  </template>
                  <div v-else class="d-flex flex-wrap gap-2">
                    <button v-if="o.status === 'rescheduled'" class="btn btn-sm btn-success" :disabled="busyId !== ''" @click="updateStatus(o, 'accepted')" data-testid="order-accept-proposal">Accept new time</button>
                    <button class="btn btn-sm btn-outline-danger" :disabled="busyId !== ''" @click="askConfirm(o)" data-testid="order-cancel">Cancel</button>
                  </div>
                </div>
                <template v-if="o.status === 'completed'">
                  <RouterLink v-if="!o.reviewed" :to="`/review/${o._id}`" class="btn btn-sm btn-brand" data-testid="order-review-link">Leave a review</RouterLink>
                  <span v-else class="badge bg-light text-dark border" data-testid="order-reviewed">Reviewed</span>
                </template>
                <div v-if="o.shop" class="d-flex flex-wrap gap-2 mt-2">
                  <button class="btn btn-sm btn-outline-secondary" :disabled="chatBusyId !== ''" @click="messageSeller(o)" data-testid="order-message-seller">Message seller</button>
                </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

