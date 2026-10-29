<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'
import { API_URL } from '@/utils/config'
import { currentUser } from '@/utils/auth'
import { notifications } from '@/utils/notifications'
import { formatPrice, formatDateTime, capitalize } from '@/utils/format'
import ReasonModal from '@/components/ReasonModal.vue'

// Owner: Basile - buyer's order dashboard
const router = useRouter()
const orders = ref([])
const loading = ref(true)
const refreshing = ref(false)
const error = ref('')
const activeTab = ref('pending')
const message = ref('')
const busyId = ref('')
const reasonModal = ref(null) // pop-up asking why the buyer is cancelling
const chatBusyId = ref('')
const chatError = ref('')
const brokenImages = ref({})
const searchText = ref('')
const fulfilmentFilter = ref('all') // Filter: 'all', 'pickup' or 'delivery'

// Explains each order status to the buyer.
const STATUS_HELP = {
  pending: 'Waiting for the seller to reply.',
  rescheduled: 'The seller suggested a new time. Accept it or cancel.',
  accepted: 'Accepted by the seller. Collect it at the time shown.',
  completed: 'Done. You can leave a review.',
  declined: 'The seller could not take this order.',
  cancelled: 'This order was cancelled.',
}

// Sets the colour of each order status tag.
const STATUS_BADGE = {
  pending: 'status-pending',
  accepted: 'status-accepted',
  declined: 'status-declined',
  rescheduled: 'status-rescheduled',
  completed: 'bg-success status-completed',
  cancelled: 'status-cancelled',
}

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
    if (order.status === 'accepted') { // The Accepted tab holds accepted orders.
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

// Groups declined and cancelled orders for the "Declined & cancelled" tab.
const pastOrders = computed(() => {
  const groupedOrders = []
  for (let i = 0; i < orders.value.length; i++) {
    const order = orders.value[i]
    if (order.status === 'declined' || order.status === 'cancelled') { // This tab holds declined and cancelled orders.
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

// Keeps orders in the current tab whose product or shop name matches the search.
const searchedOrders = computed(() => {
  const text = searchText.value.trim().toLowerCase()
  const filter = fulfilmentFilter.value
  if (text === '' && filter === 'all') return visibleOrders.value // An empty search shows the whole tab.
  const matchingOrders = []
  for (let i = 0; i < visibleOrders.value.length; i++) {
    const order = visibleOrders.value[i]
    const productName = order.product ? order.product.name.toLowerCase() : ''
    const shopName = order.shop ? order.shop.name.toLowerCase() : ''
    const matchesText = text === '' || productName.includes(text) || shopName.includes(text)
    const matchesFilter = filter === 'all' || order.fulfilment === filter
    if (matchesText && matchesFilter) {
      matchingOrders.push(order)
    }
  }
  return matchingOrders
})

// Returns the first product photo or the placeholder when it is unavailable.
function imageFor(order) {
  if (!order.product) return '/placeholder.svg' // A deleted product has no photo.
  if (brokenImages.value[order._id]) return '/placeholder.svg' // A failed photo uses the placeholder.
  return `${API_URL}/products/${order.product._id}/image/0`
}

// Checks whether an accepted order's requested time has passed.
function isOverdue(order) {
  return order.status === 'accepted' && new Date(order.requestedTime).getTime() < new Date().getTime() // Only accepted orders with a past time are overdue.
}

// Checks whether the time this order would be accepted for has already passed.
function timePassed(order) {
  let time = order.requestedTime
  if (order.status === 'rescheduled') time = order.proposedTime // A new time waits for the buyer.
  return new Date(time).getTime() < new Date().getTime()
}

// Picks the one-line status explanation, including times that have passed.
function buyerHelp(order) {
  if (isOverdue(order)) return 'The pickup time has passed. Message the seller if you still need it.'
  if (order.status === 'rescheduled' && timePassed(order)) return 'This new time has passed. Message the seller for another time.'
  return STATUS_HELP[order.status]
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

// Reloads the orders when the Refresh button is clicked.
async function refreshOrders() {
  refreshing.value = true
  error.value = ''
  await loadOrders()
  refreshing.value = false
}

// A new notification from the server reloads this list, so reload the orders too.
watch(notifications, () => { loadOrders() })

// Asks why the buyer is cancelling (shown to the seller), then cancels.
async function askCancel(order) {
  const reason = await reasonModal.value.ask({
    title: 'Cancel this order?',
    hint: 'The seller will see this reason.',
    confirmLabel: 'Yes, cancel',
  })
  if (reason) updateStatus(order, 'cancelled', reason)
}

// Checks whether the buyer may still cancel this order.
function canCancel(order) {
  return order.status === 'pending' || order.status === 'rescheduled' || order.status === 'accepted'
}

// Changes one order at a time, shows the result and refreshes the list.
async function updateStatus(order, status, reason = '') {
  if (busyId.value !== '') return // Ignore another action while a request is being sent.
  message.value = ''
  error.value = ''
  busyId.value = order._id
  try {
    await axios.put(`${API_URL}/orders/${order._id}/status`, { status, userId: currentUser.value._id, reason })
    if (status === 'cancelled') message.value = 'Order cancelled.' // Explain the successful cancellation.
    if (status === 'accepted') message.value = 'New time accepted.' // Explain the accepted proposal.
    busyId.value = ''
    await loadOrders()
  } catch (err) {
    error.value = getErrorMessage(err)
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
      <div class="d-flex justify-content-between align-items-start flex-wrap gap-2 mb-2">
        <h2 class="page-title">My orders</h2>
        <button class="btn soft-btn" :disabled="refreshing" @click="refreshOrders" data-testid="buyer-orders-refresh">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
            <path fill-rule="evenodd" d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2z" />
            <path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466" />
          </svg>
          {{ refreshing ? 'Refreshing…' : 'Refresh' }}
        </button>
      </div>
      <p v-if="loading" data-testid="buyer-orders-loading">
        <span class="spinner-border spinner-border-sm"></span> Loading…
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

        <!-- tabs: underlined, the open one is tinted -->
        <ul class="order-tabs" data-testid="buyer-orders-tabs">
          <li><button class="order-tab" :class="{ active: activeTab === 'pending' }" @click="activeTab = 'pending'" data-testid="tab-pending">Pending ({{ pendingOrders.length }})</button></li>
          <li><button class="order-tab" :class="{ active: activeTab === 'upcoming' }" @click="activeTab = 'upcoming'" data-testid="tab-upcoming">Accepted ({{ upcomingOrders.length }})</button></li>
          <li><button class="order-tab" :class="{ active: activeTab === 'completed' }" @click="activeTab = 'completed'" data-testid="tab-completed">Completed ({{ completedOrders.length }})</button></li>
          <li><button class="order-tab" :class="{ active: activeTab === 'past' }" @click="activeTab = 'past'" data-testid="tab-past">Declined &amp; cancelled ({{ pastOrders.length }})</button></li>
        </ul>

        <!-- search + filter -->
        <div class="d-flex flex-wrap gap-3 mb-4">
          <div class="search-field">
            <label class="visually-hidden" for="order-search">Search my orders</label>
            <svg class="field-icon" width="18" height="18" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
              <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001q.044.06.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1 1 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0" />
            </svg>
            <input type="search" class="form-control" id="order-search" v-model="searchText" placeholder="Search by product or shop name" data-testid="order-search" />
          </div>
          <div class="filter-field">
            <label class="visually-hidden" for="order-filter">Filter by pickup or delivery</label>
            <svg class="field-icon" width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
              <path d="M1.5 1.5A.5.5 0 0 1 2 1h12a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-.128.334L10 8.692V13.5a.5.5 0 0 1-.342.474l-3 1A.5.5 0 0 1 6 14.5V8.692L1.628 3.834A.5.5 0 0 1 1.5 3.5zm1 .5v1.308l4.372 4.858A.5.5 0 0 1 7 8.5v5.306l2-.666V8.5a.5.5 0 0 1 .128-.334L13.5 3.308V2z" />
            </svg>
            <select id="order-filter" class="form-select" v-model="fulfilmentFilter" data-testid="order-filter">
              <option value="all">Filter</option>
              <option value="pickup">Pickup only</option>
              <option value="delivery">Delivery only</option>
            </select>
          </div>
        </div>

        <div v-if="visibleOrders.length === 0" class="text-muted" data-testid="buyer-orders-tab-empty">
          <p v-if="activeTab === 'pending'">No orders waiting for the seller.</p>
          <p v-else-if="activeTab === 'upcoming'">No accepted orders yet.</p>
          <p v-else-if="activeTab === 'completed'">No completed orders yet.</p>
          <p v-else>No declined or cancelled orders.</p>
        </div>
        <p v-else-if="searchedOrders.length === 0" class="text-muted" data-testid="order-search-empty">No orders match your search. Clear the search to see all orders.</p>

        <!-- each card is only as tall as its own content -->
        <div v-else class="list-grid order-list mb-4">
          <div v-for="o in searchedOrders" :key="o._id">
            <div class="order-card" data-testid="order-row">
              <div class="d-flex gap-4 order-top">
                <img :src="imageFor(o)" :alt="o.product ? o.product.name : 'Product removed'" width="112" height="112" class="order-thumb flex-shrink-0" @error="brokenImages[o._id] = true" data-testid="order-image" />
                <div class="order-text flex-grow-1">
                  <div class="d-flex justify-content-between align-items-start gap-2">
                    <div class="order-text">
                      <h5 class="order-name text-break">{{ o.product ? o.product.name : 'Product removed' }}</h5>
                      <p class="order-shop text-break">{{ o.shop ? o.shop.name : 'Shop removed' }}</p>
                    </div>
                    <!-- soft status pill with a dot -->
                    <span v-if="!isOverdue(o)" class="status-pill flex-shrink-0" :class="`pill-${o.status}`" data-testid="order-status">{{ capitalize(o.status) }}</span>
                    <span v-if="isOverdue(o)" class="status-pill pill-overdue flex-shrink-0" data-testid="order-overdue">Overdue</span>
                  </div>

                  <ul class="order-facts">
                    <li data-testid="order-quantity-line">
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8.186 1.113a.5.5 0 0 0-.372 0L1.846 3.5 8 5.961 14.154 3.5zM15 4.239l-6.5 2.6v7.922l6.5-2.6V4.24zM7.5 14.762V6.838L1 4.239v7.923zM7.443.184a1.5 1.5 0 0 1 1.114 0l7.129 2.852A.5.5 0 0 1 16 3.5v8.662a1 1 0 0 1-.629.928l-7.185 2.874a.5.5 0 0 1-.372 0L.63 13.09a1 1 0 0 1-.63-.928V3.5a.5.5 0 0 1 .314-.464z" /></svg>
                      Quantity: {{ o.quantity }}
                    </li>
                    <li>
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M3.5 0a.5.5 0 0 1 .5.5V1h8V.5a.5.5 0 0 1 1 0V1h1a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V3a2 2 0 0 1 2-2h1V.5a.5.5 0 0 1 .5-.5M1 4v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V4z" /></svg>
                      {{ capitalize(o.fulfilment) }}: {{ formatDateTime(o.requestedTime) }}
                    </li>
                    <li class="text-break">
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M5 10.5a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 0 1h-2a.5.5 0 0 1-.5-.5m0-2a.5.5 0 0 1 .5-.5h5a.5.5 0 0 1 0 1h-5a.5.5 0 0 1-.5-.5m0-2a.5.5 0 0 1 .5-.5h5a.5.5 0 0 1 0 1h-5a.5.5 0 0 1-.5-.5m0-2a.5.5 0 0 1 .5-.5h5a.5.5 0 0 1 0 1h-5a.5.5 0 0 1-.5-.5" /><path d="M3 0h10a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2v-1h1v1a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1H3a1 1 0 0 0-1 1v1H1V2a2 2 0 0 1 2-2" /></svg>
                      Note: {{ o.customisation && o.customisation.trim() ? o.customisation : 'None' }}
                    </li>
                    <li v-if="o.fulfilment === 'delivery' && o.deliveryAddress" class="text-break" data-testid="order-delivery-details">
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M12.166 8.94c-.524 1.062-1.234 2.12-1.96 3.07A32 32 0 0 1 8 14.58a32 32 0 0 1-2.206-2.57c-.726-.95-1.436-2.008-1.96-3.07C3.304 7.867 3 6.862 3 6a5 5 0 0 1 10 0c0 .862-.305 1.867-.834 2.94M8 16s6-5.686 6-10A6 6 0 0 0 2 6c0 4.314 6 10 6 10" /><path d="M8 8a2 2 0 1 1 0-4 2 2 0 0 1 0 4m0 1a3 3 0 1 0 0-6 3 3 0 0 0 0 6" /></svg>
                      <span>Deliver to: {{ o.deliveryAddress }}{{ o.deliveryUnit ? `, ${o.deliveryUnit}` : '' }}, Singapore {{ o.deliveryPostalCode }}</span>
                    </li>
                    <!-- The server enforces privacy; this check only decides what to display. -->
                    <li v-if="o.fulfilment === 'pickup' && (o.status === 'accepted' || o.status === 'completed')" class="text-break" data-testid="order-pickup-details">
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M12.166 8.94c-.524 1.062-1.234 2.12-1.96 3.07A32 32 0 0 1 8 14.58a32 32 0 0 1-2.206-2.57c-.726-.95-1.436-2.008-1.960-3.07C3.304 7.867 3 6.862 3 6a5 5 0 0 1 10 0c0 .862-.305 1.867-.834 2.94M8 16s6-5.686 6-10A6 6 0 0 0 2 6c0 4.314 6 10 6 10" /><path d="M8 8a2 2 0 1 1 0-4 2 2 0 0 1 0 4m0 1a3 3 0 1 0 0-6 3 3 0 0 0 0 6" /></svg>
                      <span>Pickup at: <span v-if="o.pickupAddress" data-testid="order-pickup-address">{{ o.pickupAddress }}</span><span v-if="o.pickupPostalCode">{{ o.pickupAddress ? ', ' : '' }}Singapore {{ o.pickupPostalCode }}</span><span v-if="!o.pickupAddress && !o.pickupPostalCode">the seller has not added an address yet.</span><span v-if="o.shop && o.shop.nearestMrt"> &middot; Nearest MRT: {{ o.shop.nearestMrt }}</span></span>
                    </li>
                  </ul>

                  <!-- what happens next, in a tinted box -->
                  <p class="status-help" data-testid="order-status-help">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 3.5a.5.5 0 0 0-1 0V9a.5.5 0 0 0 .252.434l3.5 2a.5.5 0 0 0 .496-.868L8 8.71z" /><path d="M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16m7-8A7 7 0 1 1 1 8a7 7 0 0 1 14 0" /></svg>
                    <span>{{ buyerHelp(o) }}</span>
                  </p>
                  <p v-if="(o.status === 'declined' || o.status === 'cancelled') && o.reason" class="status-help reason" data-testid="order-reason">
                    <span><strong>{{ o.status === 'cancelled' && o.cancelledBy === 'buyer' ? 'Your reason' : "Seller's reason" }}:</strong> {{ o.reason }}</span>
                  </p>
                  <p v-if="o.status === 'rescheduled'" class="status-help proposal" data-testid="order-proposal">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M3.5 0a.5.5 0 0 1 .5.5V1h8V.5a.5.5 0 0 1 1 0V1h1a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V3a2 2 0 0 1 2-2h1V.5a.5.5 0 0 1 .5-.5M1 4v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V4z" /></svg>
                    <span>Seller suggests a new time: <strong>{{ formatDateTime(o.proposedTime) }}</strong></span>
                  </p>
                </div>
              </div>

              <!-- action buttons on the left, price on the right -->
              <div class="order-footer">
                <div class="d-flex flex-wrap gap-2">
                  <button v-if="o.status === 'rescheduled'" class="btn btn-brand pill-btn" :disabled="busyId !== '' || timePassed(o)" @click="updateStatus(o, 'accepted')" data-testid="order-accept-proposal">Accept new time</button>
                  <button v-if="canCancel(o)" class="btn btn-outline-cancel pill-btn" :disabled="busyId !== ''" @click="askCancel(o)" data-testid="order-cancel">Cancel order</button>
                  <template v-if="o.status === 'completed'">
                    <RouterLink v-if="!o.reviewed" :to="`/review/${o._id}`" class="btn btn-outline-brand pill-btn" data-testid="order-review-link">Leave a review</RouterLink>
                    <span v-else class="status-pill pill-reviewed align-self-center" data-testid="order-reviewed">Reviewed</span>
                  </template>
                  <button v-if="o.shop" class="btn btn-brand pill-btn" :disabled="chatBusyId !== ''" @click="messageSeller(o)" data-testid="order-message-seller">Message seller</button>
                </div>
                <span class="order-price" data-testid="order-price">{{ formatPrice(o.totalPrice) }}</span>
              </div>
              <p v-if="busyId === o._id" class="small text-body-secondary mt-2 mb-0" data-testid="order-sending"><span class="spinner-border spinner-border-sm"></span> Sending…</p>
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>
  <ReasonModal ref="reasonModal" />
</template>

<style scoped>
/* ---------- header ---------- */
.soft-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.6rem 1.3rem;
  border: 0;
  border-radius: 0.9rem;
  background: var(--ocean-soft);
  font-weight: 600;
  color: var(--navy);
}
.soft-btn:hover {
  background: var(--tile-hover);
  color: var(--navy);
}

/* ---------- tabs: underlined, the open one tinted ---------- */
.order-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin: 0 0 1.5rem;
  padding: 0;
  list-style: none;
  border-bottom: 1px solid var(--line);
}
.order-tab {
  margin-bottom: -1px;
  padding: 0.65rem 1.4rem;
  border: 0;
  border-bottom: 3px solid transparent;
  border-radius: 0.9rem 0.9rem 0 0;
  background: none;
  font-size: 1.02rem;
  font-weight: 500;
  color: var(--ink-soft);
}
.order-tab:hover {
  color: var(--navy);
}
.order-tab.active {
  border-bottom-color: var(--ocean);
  background: var(--ocean-soft);
  color: var(--ocean-dark);
}

/* ---------- search + filter ---------- */
.search-field,
.filter-field {
  position: relative;
}
.search-field {
  flex: 1 1 320px;
  max-width: 720px;
}
.filter-field {
  flex: 0 0 170px;
}
.field-icon {
  position: absolute;
  top: 50%;
  left: 1rem;
  transform: translateY(-50%);
  color: var(--muted);
  pointer-events: none;
}
.search-field .form-control,
.filter-field .form-select {
  height: 52px;
  padding-left: 2.8rem;
  border-radius: 0.9rem;
  background-color: var(--surface);
}

/* ---------- order cards ---------- */
.order-card {
  padding: 1.6rem;
  border: 1px solid var(--line);
  border-radius: 1.25rem;
  background: var(--surface);
}
.order-thumb {
  width: 112px;
  height: 112px;
  border-radius: 1rem;
  object-fit: cover;
}
.order-text {
  min-width: 0;
}
.order-name {
  margin: 0 0 0.25rem;
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--ink);
}
.order-shop {
  margin: 0;
  color: var(--ink-soft);
}

/* soft status pill with a dot (dot = the status colour) */
.status-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.35rem 0.9rem;
  border-radius: 999px;
  font-size: 0.9rem;
  font-weight: 500;
  white-space: nowrap;
}
.status-pill::before {
  content: '';
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: currentColor;
}
.pill-pending { background: #fdf0c8; color: #a8740a; }
.pill-accepted { background: #e2f3e8; color: #23804a; }
.pill-rescheduled { background: var(--aqua-soft); color: var(--aqua-dark); }
.pill-completed { background: var(--tile); color: var(--ink-soft); }
.pill-declined,
.pill-cancelled,
.pill-overdue { background: #fbe4e3; color: #b8312f; }
.pill-reviewed { background: var(--tile); color: var(--muted); }

/* quantity / time / note with an icon each */
.order-facts {
  margin: 1rem 0 0;
  padding: 0;
  list-style: none;
}
.order-facts li {
  display: flex;
  align-items: flex-start;
  gap: 0.65rem;
  margin-bottom: 0.55rem;
  color: var(--ink);
}
.order-facts svg {
  flex-shrink: 0;
  margin-top: 0.2rem;
  color: var(--ink-soft);
}

/* "Waiting for the seller to reply." etc. */
.status-help {
  display: flex;
  align-items: flex-start;
  gap: 0.6rem;
  margin: 0.6rem 0 0;
  padding: 0.75rem 1rem;
  border-radius: 0.8rem;
  background: var(--surface-soft);
  font-size: 0.9rem;
  color: var(--ink-soft);
}
.status-help svg {
  flex-shrink: 0;
  margin-top: 0.15rem;
}
.status-help.proposal {
  background: var(--aqua-soft);
  color: var(--ink);
}
/* why the order was declined / cancelled */
.status-help.reason {
  background: rgba(var(--rose-rgb), 0.08);
  color: var(--ink);
  overflow-wrap: anywhere;
}

.order-footer {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  gap: 0.75rem;
  margin-top: 1.5rem;
}
.pill-btn {
  padding: 0.55rem 1.4rem;
  border-radius: 999px;
  font-weight: 600;
}
.btn-outline-brand {
  border: 1.5px solid var(--ocean);
  background: var(--surface);
  color: var(--ocean-dark);
}
.btn-outline-brand:hover,
.btn-outline-brand:focus-visible {
  border-color: var(--ocean-dark);
  background: var(--ocean-soft);
  color: var(--ocean-dark);
}
/* "Cancel order": red outline */
.btn-outline-cancel {
  border: 1.5px solid var(--rose);
  background: var(--surface);
  color: var(--rose);
}
.btn-outline-cancel:hover,
.btn-outline-cancel:focus-visible {
  border-color: var(--rose);
  background: var(--bs-danger-bg-subtle);
  color: var(--bs-danger-text-emphasis);
}
.order-price {
  margin-left: auto;
  font-size: 1.6rem;
  font-weight: 700;
  color: var(--ink);
}

/* each row is only as tall as its own cards (the team grid makes every row equal) */
.order-list {
  grid-auto-rows: auto;
  gap: 1.5rem;
}

/* phones: smaller photo, so the text has room */
@media (max-width: 575.98px) {
  .order-card {
    padding: 1.1rem;
  }
  .order-thumb {
    width: 72px;
    height: 72px;
  }
  .order-top {
    gap: 1rem !important;
  }
}
</style>
