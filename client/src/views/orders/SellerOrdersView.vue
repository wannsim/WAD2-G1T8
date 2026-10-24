<script setup>
import SearchBox from '@/components/SearchBox.vue'
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'
import { API_URL } from '@/utils/config'
import { currentUser } from '@/utils/auth'
import { notifications } from '@/utils/notifications'
import { ORDER_STATUS_BADGE } from '@/utils/constants'
import { formatPrice, formatDateTime, capitalize } from '@/utils/format'

// Owner: Basile - seller's order dashboard: accept / decline / propose new time / complete
const router = useRouter()
const orders = ref([])
const proposals = ref({}) // { orderId: 'new datetime' } - one input per order
const loading = ref(true)
const refreshing = ref(false)
const error = ref('')
const showDone = ref(true)
const activeGroup = ref('needs-reply')
const shop = ref(null)
const message = ref('')
const busyId = ref('')
const confirmId = ref('')
const confirmStatus = ref('')
const proposeOpenId = ref('') // The order whose new-time input is open.
const chatBusyId = ref('')
const chatError = ref('')
const brokenImages = ref({})

// Explains each order status to the seller.
const STATUS_HELP_SELLER = {
  pending: 'Waiting for your reply.',
  rescheduled: 'Waiting for the buyer to accept your new time.',
  accepted: 'Accepted. Hand it over at the time shown.',
  completed: 'Done.',
  declined: 'You declined this order.',
  cancelled: 'This order was cancelled.',
}

// Sets the colour of each order status tag.
const STATUS_BADGE = {
  pending: 'bg-warning text-dark',
  accepted: 'bg-success',
  declined: 'bg-danger',
  rescheduled: 'bg-info text-dark',
  completed: 'bg-success',
  cancelled: 'bg-dark',
}

// Groups pending orders that need the seller's reply.
const needsReply = computed(() => {
  const groupedOrders = []
  for (let i = 0; i < orders.value.length; i++) {
    const order = orders.value[i]
    if (order.status === 'pending') groupedOrders.push(order) // Needs reply includes pending orders.
  }
  return groupedOrders
})

// Groups proposed times that are waiting for the buyer.
const waitingOnBuyer = computed(() => {
  const groupedOrders = []
  for (let i = 0; i < orders.value.length; i++) {
    const order = orders.value[i]
    if (order.status === 'rescheduled') groupedOrders.push(order) // Waiting on buyer includes rescheduled orders.
  }
  return groupedOrders
})

// Groups accepted orders, including overdue pickups.
const upcoming = computed(() => {
  const groupedOrders = []
  for (let i = 0; i < orders.value.length; i++) {
    const order = orders.value[i]
    if (order.status === 'accepted') groupedOrders.push(order) // The Accepted tab holds all accepted orders.
  }
  return groupedOrders
})

// Groups orders that have reached a final status.
const done = computed(() => {
  const groupedOrders = []
  for (let i = 0; i < orders.value.length; i++) {
    const order = orders.value[i]
    if (order.status === 'completed' || order.status === 'declined' || order.status === 'cancelled') groupedOrders.push(order) // Done includes the three final statuses.
  }
  return groupedOrders
})

// ---- search (product, buyer, note, status) - filters the order lists, not the dashboard numbers ----
const search = ref('')
function matchesSearch(order) {
  const q = search.value.trim().toLowerCase()
  if (!q) return true
  return [order.product?.name, order.buyer?.name, order.customisation, order.status, order.fulfilment, order.deliveryAddress, order.deliveryPostalCode]
    .some((text) => (text || '').toLowerCase().includes(q))
}
const shown = computed(() => ({
  needsReply: needsReply.value.filter(matchesSearch),
  waitingOnBuyer: waitingOnBuyer.value.filter(matchesSearch),
  upcoming: upcoming.value.filter(matchesSearch),
  done: done.value.filter(matchesSearch),
}))
const shownCount = computed(() => Object.values(shown.value).reduce((sum, list) => sum + list.length, 0))
watch(search, (q) => {
  if (q.trim()) showDone.value = true // matches in Done should be visible too
})

// Which done orders to show: 'all', 'completed', 'declined' or 'cancelled'.
const doneStatus = ref('all')
// Order of the done list: 'newest' or 'oldest' pickup first.
const doneSort = ref('newest')

// Done orders after the status filter, newest or oldest pickup first.
const doneList = computed(() => {
  const filtered = []
  for (let i = 0; i < shown.value.done.length; i++) {
    const order = shown.value.done[i]
    if (doneStatus.value === 'all' || order.status === doneStatus.value) filtered.push(order) // Keep orders with the chosen status.
  }
  if (doneSort.value === 'oldest') return filtered // The server already sends the oldest pickup first.
  const newestFirst = []
  for (let i = filtered.length - 1; i >= 0; i--) newestFirst.push(filtered[i]) // Walk backwards for newest first.
  return newestFirst
})

// Counts accepted orders whose pickup time has passed.
const overdueCount = computed(() => {
  let count = 0
  for (let i = 0; i < upcoming.value.length; i++) {
    if (isOverdue(upcoming.value[i])) count++ // Overdue orders stay in the Accepted tab.
  }
  return count
})

// Counts current orders without including any final statuses.
const totalActive = computed(() => {
  let count = 0
  for (let i = 0; i < orders.value.length; i++) {
    const order = orders.value[i]
    if (order.status === 'pending' || order.status === 'rescheduled' || order.status === 'accepted') count++ // Count current orders only.
  }
  return count
})

// Summarises the three active order groups as counts and percentages.
const breakdown = computed(() => {
  const groups = [
    { label: 'Needs reply', status: 'pending', count: needsReply.value.length, percent: 0 },
    { label: 'Waiting on buyer', status: 'rescheduled', count: waitingOnBuyer.value.length, percent: 0 },
    { label: 'Accepted', status: 'accepted', count: upcoming.value.length, percent: 0 },
  ]
  for (let i = 0; i < groups.length; i++) {
    if (totalActive.value > 0) { // Avoid dividing by zero when there are no active orders.
      groups[i].percent = Math.round(groups[i].count * 100 / totalActive.value)
    }
  }
  return groups
})

// Returns the first accepted order whose requested time has not passed.
const nextPickup = computed(() => {
  for (let i = 0; i < upcoming.value.length; i++) {
    if (!isOverdue(upcoming.value[i])) return upcoming.value[i] // The server already sorts soonest first.
  }
  return null
})

// Returns the first product photo or the placeholder when it is unavailable.
function imageFor(order) {
  if (!order.product) return '/placeholder.svg' // A deleted product has no photo.
  if (brokenImages.value[order._id]) return '/placeholder.svg' // A failed photo uses the placeholder.
  return `${API_URL}/products/${order.product._id}/image/0`
}

// Uses the server's error message, or a general message if none is available.
function getErrorMessage(err) {
  if (err.response && err.response.data && err.response.data.message) {
    return err.response.data.message
  }
  return 'Something went wrong. Please try again.'
}

// Opens the seller's chat with this order's buyer.
async function messageBuyer(order) {
  if (chatBusyId.value !== '') return // Ignore another chat click while a request is being sent.
  chatError.value = ''
  chatBusyId.value = order._id
  try {
    const response = await axios.post(`${API_URL}/chats/start`, {
      buyer: order.buyer._id,
      shop: shop.value._id,
    })
    router.push('/chats/' + response.data._id)
    chatBusyId.value = ''
  } catch (err) {
    chatError.value = getErrorMessage(err)
    chatBusyId.value = ''
  }
}

// Checks whether an accepted order's requested time has passed.
function isOverdue(order) {
  return order.status === 'accepted' && new Date(order.requestedTime).getTime() < new Date().getTime() // Only accepted orders can be overdue.
}

// Loads the seller's shop and then its orders in the order returned by the server.
async function loadOrders() {
  try {
    const shopResponse = await axios.get(`${API_URL}/shops/mine/${currentUser.value._id}`)
    shop.value = shopResponse.data
    if (!shop.value) {
      loading.value = false
      router.push('/seller/shop')
      return
    }
    const response = await axios.get(`${API_URL}/orders/shop/${shop.value._id}`)
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

// Stores the order and action that need the seller's confirmation.
function askConfirm(order, status) {
  confirmId.value = order._id
  confirmStatus.value = status
  proposeOpenId.value = ''
}

// Closes the confirmation without changing an order.
function clearConfirm() {
  confirmId.value = ''
  confirmStatus.value = ''
}

// Opens or closes the new-time input for one order.
function toggleProposal(order) {
  if (proposeOpenId.value === order._id) {
    proposeOpenId.value = ''
  } else {
    proposeOpenId.value = order._id
    clearConfirm()
  }
}

// Closes the new-time input without changing an order.
function closeProposal() {
  proposeOpenId.value = ''
}

// Changes one order at a time, shows the result and refreshes the dashboard.
async function updateStatus(order, status) {
  if (busyId.value !== '') return // Ignore another action while a request is being sent.
  message.value = ''
  error.value = ''
  busyId.value = order._id
  try {
    await axios.put(`${API_URL}/orders/${order._id}/status`, {
      status,
      userId: currentUser.value._id,
      proposedTime: proposals.value[order._id],
    })
    if (status === 'accepted') message.value = 'Order accepted.' // Explain the accepted order.
    if (status === 'declined') message.value = 'Order declined.' // Explain the declined order.
    if (status === 'rescheduled') message.value = 'New time sent to the buyer.' // Explain the proposed time.
    if (status === 'completed') message.value = 'Order marked as completed.' // Explain the completed order.
    if (status === 'cancelled') message.value = 'Order cancelled.' // Explain the cancelled order.
    clearConfirm()
    closeProposal()
    busyId.value = ''
    await loadOrders()
  } catch (err) {
    error.value = getErrorMessage(err)
    clearConfirm()
    closeProposal()
    busyId.value = ''
    await loadOrders()
  }
}

// Checks the proposed time before sending it to the buyer.
async function proposeTime(order) {
  message.value = ''
  error.value = ''
  const proposedTime = proposals.value[order._id]
  if (!proposedTime) { // A proposal needs a date and time.
    error.value = 'Pick a date and time first.'
    return
  }
  if (!(new Date().getTime() < new Date(proposedTime).getTime())) { // The proposed time must be later than now.
    error.value = 'Pick a time in the future.'
    return
  }
  await updateStatus(order, 'rescheduled')
}

onMounted(() => {
  if (!currentUser.value || currentUser.value.role !== 'seller') {
    router.push('/login')
    return
  }
  loadOrders()
})
</script>

<template>
  <div class="row">
    <div class="col-12">
      <div class="d-flex justify-content-between align-items-start flex-wrap gap-2">
        <h2 class="page-title">Order dashboard</h2>
        <button class="btn btn-outline-secondary" :disabled="refreshing" @click="refreshOrders" data-testid="seller-orders-refresh">
          {{ refreshing ? 'Refreshing…' : 'Refresh' }}
        </button>
      </div>
      <p v-if="loading" data-testid="seller-orders-loading">
        <span class="spinner-border spinner-border-sm"></span> Loading…
      </p>
      <div v-else-if="error && orders.length === 0" class="alert alert-danger" data-testid="seller-orders-error">{{ error }}</div>
      <template v-else>
        <!-- Shows the seller's current order counts. -->
        <div class="row g-3 mb-3" data-testid="seller-dashboard-stats">
          <div class="col-6 col-lg-3">
            <div class="card p-3">
              <h3 class="h6 text-body-secondary mb-1">Needs reply</h3>
              <p class="stat-value mb-1" data-testid="stat-needs-reply">{{ needsReply.length }}</p>
              <p class="small text-body-secondary mb-0">Waiting for your answer</p>
            </div>
          </div>
          <div class="col-6 col-lg-3">
            <div class="card p-3">
              <h3 class="h6 text-body-secondary mb-1">Accepted</h3>
              <p class="stat-value mb-1" data-testid="stat-upcoming">{{ upcoming.length }}</p>
              <p class="small text-body-secondary mb-0">Pickups coming up</p>
            </div>
          </div>
          <div class="col-6 col-lg-3">
            <div class="card p-3">
              <h3 class="h6 text-body-secondary mb-1">Overdue</h3>
              <p class="stat-value mb-1" data-testid="stat-overdue">{{ overdueCount }}</p>
              <p class="small text-body-secondary mb-0">Pickup time has passed</p>
            </div>
          </div>
          <div class="col-6 col-lg-3">
            <div class="card p-3">
              <h3 class="h6 text-body-secondary mb-1">Total active</h3>
              <p class="stat-value mb-1" data-testid="stat-total-active">{{ totalActive }}</p>
              <p class="small text-body-secondary mb-0">Not completed yet</p>
            </div>
          </div>
        </div>
        <div v-if="message" class="alert alert-success" data-testid="seller-orders-message">{{ message }}</div>
        <div v-if="error" class="alert alert-danger" data-testid="seller-orders-error">{{ error }}</div>
        <div v-if="chatError" class="alert alert-danger" data-testid="order-chat-error">{{ chatError }}</div>
        <div class="row g-3 mb-3">
          <div class="col-12 col-md-6 col-xl-4">
            <div class="card" data-testid="status-breakdown">
              <div class="card-body p-3">
                <h6>Active orders</h6>
                <p v-if="totalActive === 0" class="mb-0">No active orders.</p>
                <template v-else>
                  <div v-for="b in breakdown" :key="b.status" class="mb-2">
                    <p class="d-flex justify-content-between small mb-1"><span>{{ b.label }}</span><span>({{ b.count }})</span></p>
                    <div class="progress order-bar">
                      <div class="progress-bar" :class="ORDER_STATUS_BADGE[b.status]" :style="{ width: b.percent + '%' }"></div>
                    </div>
                  </div>
                </template>
              </div>
            </div>
          </div>
          <div class="col-12 col-md-6 col-xl-4">
            <div class="card" data-testid="next-pickup">
              <div class="card-body p-3">
                <h6>Next pickup</h6>
                <template v-if="nextPickup">
                  <p class="mb-1 fw-bold text-break">{{ nextPickup.product ? nextPickup.product.name : 'Product removed' }}</p>
                  <p class="mb-0 small text-body-secondary text-break">{{ nextPickup.buyer ? nextPickup.buyer.name : 'Buyer removed' }} &middot; {{ formatDateTime(nextPickup.requestedTime) }}</p>
                </template>
                <p v-else class="mb-0">No upcoming pickups.</p>
              </div>
            </div>
          </div>
        </div>
        <!-- search the order lists (long lists are easier to go through) -->
        <div v-if="orders.length > 0" class="d-flex align-items-center flex-wrap gap-2 mb-3">
          <SearchBox v-model="search" class="flex-grow-1 order-search" placeholder="Search by product, buyer or note" label="Search orders" />
          <span v-if="search.trim()" class="small text-muted" aria-live="polite">{{ shownCount }} {{ shownCount === 1 ? 'order' : 'orders' }} found</span>
        </div>
        <p v-if="orders.length === 0" class="text-muted" data-testid="seller-orders-empty">No order requests yet.</p>
        <template v-else>
          <ul class="nav nav-pills mb-3" data-testid="seller-orders-tabs">
            <li class="nav-item">
              <button class="nav-link" :class="{ active: activeGroup === 'needs-reply' }" @click="activeGroup = 'needs-reply'" data-testid="seller-tab-needs-reply">Needs reply ({{ shown.needsReply.length }})</button>
            </li>
            <li class="nav-item">
              <button class="nav-link" :class="{ active: activeGroup === 'waiting-buyer' }" @click="activeGroup = 'waiting-buyer'" data-testid="seller-tab-waiting-buyer">Waiting on buyer ({{ shown.waitingOnBuyer.length }})</button>
            </li>
            <li class="nav-item">
              <button class="nav-link" :class="{ active: activeGroup === 'upcoming' }" @click="activeGroup = 'upcoming'" data-testid="seller-tab-upcoming">Accepted ({{ shown.upcoming.length }})</button>
            </li>
            <li class="nav-item">
              <button class="nav-link" :class="{ active: activeGroup === 'done' }" @click="activeGroup = 'done'" data-testid="seller-tab-done">Done ({{ shown.done.length }})</button>
            </li>
          </ul>
          <div v-if="activeGroup === 'needs-reply'" class="mb-4" data-testid="group-needs-reply">
            <h5 class="mb-2">Needs reply ({{ shown.needsReply.length }})</h5>
            <p v-if="shown.needsReply.length === 0" data-testid="group-empty">{{ search.trim() ? 'No matching orders.' : 'Nothing here.' }}</p>
            <div v-else class="list-grid order-list mb-4">
              <div v-for="o in shown.needsReply" :key="o._id">
                <div class="card h-auto" data-testid="order-row">
                  <div class="card-body d-flex gap-3">
                    <img :src="imageFor(o)" :alt="o.product ? o.product.name : 'Product removed'" width="72" height="72" class="order-thumb rounded flex-shrink-0" @error="brokenImages[o._id] = true" data-testid="order-image" />
                    <div class="order-text d-flex flex-column flex-grow-1">
                    <div class="d-flex justify-content-between flex-wrap gap-2">
                      <h5 class="text-break">{{ o.product ? o.product.name : 'Product removed' }}</h5>
                      <span class="badge align-self-start flex-shrink-0 text-nowrap" :class="STATUS_BADGE[o.status]" data-testid="order-status">{{ capitalize(o.status) }}</span>
                    </div>
                    <p class="mb-1 text-body-secondary text-break">{{ o.buyer ? o.buyer.name : 'Buyer removed' }}</p>
                    <p class="mb-1" data-testid="order-quantity-line">Quantity: {{ o.quantity }}</p>
                    <p class="mb-1">{{ capitalize(o.fulfilment) }} &middot; {{ formatDateTime(o.requestedTime) }}</p>
                    <p v-if="o.fulfilment === 'delivery' && o.deliveryAddress" class="mb-1 text-break" data-testid="order-delivery-to">Deliver to: {{ o.deliveryAddress }}{{ o.deliveryUnit ? `, ${o.deliveryUnit}` : '' }}, Singapore {{ o.deliveryPostalCode }}</p>
                    <p class="mb-1 text-break">Note: {{ o.customisation && o.customisation.trim() ? o.customisation : 'None' }}</p>
                    <p class="mb-1 small text-body-secondary" data-testid="order-status-help">{{ isOverdue(o) ? 'The pickup time has passed. Mark it completed or message the buyer.' : STATUS_HELP_SELLER[o.status] }}</p>
                    <div class="mt-auto pt-2">
                      <div v-if="confirmId === o._id && confirmStatus === 'declined'">
                        <p class="mb-1">Decline this order?</p>
                        <div class="d-flex flex-wrap gap-2">
                          <button class="btn btn-sm btn-danger" :disabled="busyId !== ''" @click="updateStatus(o, confirmStatus)" data-testid="order-confirm-yes">Yes, decline</button>
                          <button class="btn btn-sm btn-secondary" :disabled="busyId !== ''" @click="clearConfirm" data-testid="order-confirm-no">Keep order</button>
                        </div>
                      </div>
                      <template v-else>
                        <div class="d-flex flex-wrap gap-2">
                          <button class="btn btn-sm btn-success" :disabled="busyId !== ''" @click="updateStatus(o, 'accepted')" data-testid="order-accept">Accept</button>
                          <button class="btn btn-sm btn-danger" :disabled="busyId !== ''" @click="askConfirm(o, 'declined')" data-testid="order-decline">Decline</button>
                          <button class="btn btn-sm btn-secondary" :disabled="busyId !== ''" @click="toggleProposal(o)" data-testid="order-propose-toggle">Propose new time</button>
                          <button v-if="o.buyer" class="btn btn-sm btn-secondary" :disabled="chatBusyId !== ''" @click="messageBuyer(o)" data-testid="order-message-buyer">Message buyer</button>
                        </div>
                        <div v-if="proposeOpenId === o._id" class="mt-2">
                          <label class="form-label" :for="'proposed-time-' + o._id">Propose new time</label>
                          <input type="datetime-local" class="form-control form-control-sm" :id="'proposed-time-' + o._id" v-model="proposals[o._id]" :disabled="busyId !== ''" data-testid="order-propose-input" />
                          <div class="d-flex flex-wrap gap-2 mt-2">
                            <button class="btn btn-sm btn-secondary" :disabled="busyId !== ''" @click="proposeTime(o)" data-testid="order-propose-submit">Send new time</button>
                          </div>
                        </div>
                      </template>
                      <div class="d-flex justify-content-end mt-2">
                        <span class="fs-5 fw-bold" data-testid="order-price">{{ formatPrice(o.totalPrice) }}</span>
                      </div>
                    </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div v-if="activeGroup === 'waiting-buyer'" class="mb-4" data-testid="group-waiting-buyer">
            <h5 class="mb-2">Waiting on buyer ({{ shown.waitingOnBuyer.length }})</h5>
            <p v-if="shown.waitingOnBuyer.length === 0" data-testid="group-empty">{{ search.trim() ? 'No matching orders.' : 'Nothing here.' }}</p>
            <div v-else class="list-grid order-list mb-4">
              <div v-for="o in shown.waitingOnBuyer" :key="o._id">
                <div class="card h-auto" data-testid="order-row">
                  <div class="card-body d-flex gap-3">
                    <img :src="imageFor(o)" :alt="o.product ? o.product.name : 'Product removed'" width="72" height="72" class="order-thumb rounded flex-shrink-0" @error="brokenImages[o._id] = true" data-testid="order-image" />
                    <div class="order-text d-flex flex-column flex-grow-1">
                    <div class="d-flex justify-content-between flex-wrap gap-2">
                      <h5 class="text-break">{{ o.product ? o.product.name : 'Product removed' }}</h5>
                      <span class="badge align-self-start flex-shrink-0 text-nowrap" :class="STATUS_BADGE[o.status]" data-testid="order-status">{{ capitalize(o.status) }}</span>
                    </div>
                    <p class="mb-1 text-body-secondary text-break">{{ o.buyer ? o.buyer.name : 'Buyer removed' }}</p>
                    <p class="mb-1" data-testid="order-quantity-line">Quantity: {{ o.quantity }}</p>
                    <p class="mb-1">{{ capitalize(o.fulfilment) }} &middot; {{ formatDateTime(o.requestedTime) }}</p>
                    <p v-if="o.fulfilment === 'delivery' && o.deliveryAddress" class="mb-1 text-break" data-testid="order-delivery-to">Deliver to: {{ o.deliveryAddress }}{{ o.deliveryUnit ? `, ${o.deliveryUnit}` : '' }}, Singapore {{ o.deliveryPostalCode }}</p>
                    <p class="mb-1 text-break">Note: {{ o.customisation && o.customisation.trim() ? o.customisation : 'None' }}</p>
                    <p class="mb-1 small text-body-secondary" data-testid="order-status-help">{{ isOverdue(o) ? 'The pickup time has passed. Mark it completed or message the buyer.' : STATUS_HELP_SELLER[o.status] }}</p>
                    <p class="mb-1">Proposed time: <strong>{{ formatDateTime(o.proposedTime) }}</strong></p>
                    <div class="mt-auto pt-2">
                    <div v-if="o.buyer" class="d-flex flex-wrap gap-2">
                      <button class="btn btn-sm btn-secondary" :disabled="chatBusyId !== ''" @click="messageBuyer(o)" data-testid="order-message-buyer">Message buyer</button>
                    </div>
                    <div class="d-flex justify-content-end mt-2">
                      <span class="fs-5 fw-bold" data-testid="order-price">{{ formatPrice(o.totalPrice) }}</span>
                    </div>
                    </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div v-if="activeGroup === 'upcoming'" class="mb-4" data-testid="group-upcoming">
            <h5 class="mb-2">Accepted ({{ shown.upcoming.length }})</h5>
            <p v-if="shown.upcoming.length === 0" data-testid="group-empty">{{ search.trim() ? 'No matching orders.' : 'Nothing here.' }}</p>
            <div v-else class="list-grid order-list mb-4">
              <div v-for="o in shown.upcoming" :key="o._id">
                <div class="card h-auto" data-testid="order-row">
                  <div class="card-body d-flex gap-3">
                    <img :src="imageFor(o)" :alt="o.product ? o.product.name : 'Product removed'" width="72" height="72" class="order-thumb rounded flex-shrink-0" @error="brokenImages[o._id] = true" data-testid="order-image" />
                    <div class="order-text d-flex flex-column flex-grow-1">
                    <div class="d-flex justify-content-between flex-wrap gap-2">
                      <h5 class="text-break">{{ o.product ? o.product.name : 'Product removed' }}</h5>
                      <div class="d-flex flex-wrap gap-2 align-self-start">
                        <span class="badge align-self-start flex-shrink-0 text-nowrap" :class="STATUS_BADGE[o.status]" data-testid="order-status">{{ capitalize(o.status) }}</span>
                        <span v-if="isOverdue(o)" class="badge bg-danger flex-shrink-0 text-nowrap" data-testid="order-overdue">Overdue</span>
                      </div>
                    </div>
                    <p class="mb-1 text-body-secondary text-break">{{ o.buyer ? o.buyer.name : 'Buyer removed' }}</p>
                    <p class="mb-1" data-testid="order-quantity-line">Quantity: {{ o.quantity }}</p>
                    <p class="mb-1">{{ capitalize(o.fulfilment) }} &middot; {{ formatDateTime(o.requestedTime) }}</p>
                    <p v-if="o.fulfilment === 'delivery' && o.deliveryAddress" class="mb-1 text-break" data-testid="order-delivery-to">Deliver to: {{ o.deliveryAddress }}{{ o.deliveryUnit ? `, ${o.deliveryUnit}` : '' }}, Singapore {{ o.deliveryPostalCode }}</p>
                    <p class="mb-1 text-break">Note: {{ o.customisation && o.customisation.trim() ? o.customisation : 'None' }}</p>
                    <p class="mb-1 small text-body-secondary" data-testid="order-status-help">{{ isOverdue(o) ? 'The pickup time has passed. Mark it completed or message the buyer.' : STATUS_HELP_SELLER[o.status] }}</p>
                    <div class="mt-auto pt-2">
                      <div v-if="confirmId === o._id && (confirmStatus === 'completed' || confirmStatus === 'cancelled')">
                        <p class="mb-1">{{ confirmStatus === 'completed' ? 'Mark this order as completed?' : 'Cancel this order?' }}</p>
                        <div class="d-flex flex-wrap gap-2">
                          <button class="btn btn-sm" :class="confirmStatus === 'completed' ? 'btn-success' : 'btn-danger'" :disabled="busyId !== ''" @click="updateStatus(o, confirmStatus)" data-testid="order-confirm-yes">{{ confirmStatus === 'completed' ? 'Yes, completed' : 'Yes, cancel' }}</button>
                          <button class="btn btn-sm btn-secondary" :disabled="busyId !== ''" @click="clearConfirm" data-testid="order-confirm-no">Keep order</button>
                        </div>
                      </div>
                      <div v-else class="d-flex flex-wrap gap-2">
                        <button class="btn btn-sm btn-success" :disabled="busyId !== ''" @click="askConfirm(o, 'completed')" data-testid="order-complete">Mark completed</button>
                        <button class="btn btn-sm btn-danger" :disabled="busyId !== ''" @click="askConfirm(o, 'cancelled')" data-testid="order-cancel">Cancel</button>
                        <button v-if="o.buyer" class="btn btn-sm btn-secondary" :disabled="chatBusyId !== ''" @click="messageBuyer(o)" data-testid="order-message-buyer">Message buyer</button>
                      </div>
                      <div class="d-flex justify-content-end mt-2">
                        <span class="fs-5 fw-bold" data-testid="order-price">{{ formatPrice(o.totalPrice) }}</span>
                      </div>
                    </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div v-if="activeGroup === 'done'" class="mb-4" data-testid="group-done">
            <h5 class="mb-2">Done ({{ shown.done.length }})</h5>
            <div class="d-flex flex-wrap gap-2 mb-3">
              <button class="btn btn-sm btn-secondary" @click="showDone = !showDone" data-testid="group-done-toggle">{{ showDone ? 'Hide done orders' : 'Show done orders (' + shown.done.length + ')' }}</button>
            </div>
            <template v-if="showDone">
              <div class="d-flex flex-wrap gap-3 mb-3">
                <div>
                  <label class="form-label small mb-1" for="done-status">Show</label>
                  <select id="done-status" class="form-select form-select-sm" v-model="doneStatus" data-testid="done-filter-status">
                    <option value="all">All</option>
                    <option value="completed">Completed</option>
                    <option value="declined">Declined</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
                <div>
                  <label class="form-label small mb-1" for="done-sort">Sort</label>
                  <select id="done-sort" class="form-select form-select-sm" v-model="doneSort" data-testid="done-sort">
                    <option value="newest">Newest pickup first</option>
                    <option value="oldest">Oldest pickup first</option>
                  </select>
                </div>
              </div>
              <p v-if="doneList.length === 0" data-testid="group-empty">{{ search.trim() || doneStatus !== 'all' ? 'No matching orders.' : 'Nothing here.' }}</p>
              <div v-else class="list-grid order-list mb-4">
                <div v-for="o in doneList" :key="o._id">
                  <div class="card h-auto" data-testid="order-row">
                    <div class="card-body d-flex gap-3">
                      <img :src="imageFor(o)" :alt="o.product ? o.product.name : 'Product removed'" width="72" height="72" class="order-thumb rounded flex-shrink-0" @error="brokenImages[o._id] = true" data-testid="order-image" />
                      <div class="order-text d-flex flex-column flex-grow-1">
                      <div class="d-flex justify-content-between flex-wrap gap-2">
                        <h5 class="text-break">{{ o.product ? o.product.name : 'Product removed' }}</h5>
                        <span class="badge align-self-start flex-shrink-0 text-nowrap" :class="STATUS_BADGE[o.status]" data-testid="order-status">{{ capitalize(o.status) }}</span>
                      </div>
                      <p class="mb-1 text-body-secondary text-break">{{ o.buyer ? o.buyer.name : 'Buyer removed' }}</p>
                      <p class="mb-1" data-testid="order-quantity-line">Quantity: {{ o.quantity }}</p>
                      <p class="mb-1">{{ capitalize(o.fulfilment) }} &middot; {{ formatDateTime(o.requestedTime) }}</p>
                      <p v-if="o.fulfilment === 'delivery' && o.deliveryAddress" class="mb-1 text-break" data-testid="order-delivery-to">Deliver to: {{ o.deliveryAddress }}{{ o.deliveryUnit ? `, ${o.deliveryUnit}` : '' }}, Singapore {{ o.deliveryPostalCode }}</p>
                      <p class="mb-1 text-break">Note: {{ o.customisation && o.customisation.trim() ? o.customisation : 'None' }}</p>
                      <p class="mb-1 small text-body-secondary" data-testid="order-status-help">{{ isOverdue(o) ? 'The pickup time has passed. Mark it completed or message the buyer.' : STATUS_HELP_SELLER[o.status] }}</p>
                      <div class="mt-auto pt-2">
                      <div v-if="o.buyer" class="d-flex flex-wrap gap-2">
                        <button class="btn btn-sm btn-secondary" :disabled="chatBusyId !== ''" @click="messageBuyer(o)" data-testid="order-message-buyer">Message buyer</button>
                      </div>
                      <div class="d-flex justify-content-end mt-2">
                        <span class="fs-5 fw-bold" data-testid="order-price">{{ formatPrice(o.totalPrice) }}</span>
                      </div>
                      </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </template>
          </div>
        </template>
      </template>
    </div>
  </div>
</template>

<style scoped>
.order-thumb {
  width: 72px;
  height: 72px;
  object-fit: cover;
  flex-shrink: 0;
}

.order-text {
  min-width: 0;
}

.order-bar {
  height: 0.5rem;
  border-radius: 999px;
}

.stat-value {
  color: var(--brand-dark);
  font-size: 2rem;
  font-weight: 700;
  line-height: 1.1;
}

/* each row is only as tall as its own cards (the team grid makes every row equal) */
.order-list {
  grid-auto-rows: auto;
}
</style>
