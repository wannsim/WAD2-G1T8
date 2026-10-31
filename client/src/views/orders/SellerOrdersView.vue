<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'
import { API_URL } from '@/utils/config'
import { currentUser } from '@/utils/auth'
import { notifications } from '@/utils/notifications'
import { formatPrice, formatDateTime, capitalize } from '@/utils/format'
import ReasonModal from '@/components/ReasonModal.vue'

// Owner: Basile - seller's order dashboard: accept / decline / propose new time / complete
const router = useRouter()
const orders = ref([])
const proposals = ref({}) // { orderId: 'new datetime' } - one input per order
const loading = ref(true)
const refreshing = ref(false)
const error = ref('')
const activeGroup = ref('needs-reply')
const shop = ref(null)
const message = ref('')
const busyId = ref('')
const confirmId = ref('')
const confirmStatus = ref('')
const reasonModal = ref(null) // pop-up asking why the seller is declining / cancelling
const proposeOpenId = ref('') // The order whose new-time input is open.
const chatBusyId = ref('')
const chatError = ref('')
const brokenImages = ref({})

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

// Which done orders to show: 'all', 'completed', 'declined' or 'cancelled'.
const doneStatus = ref('all')
// Order of every list: 'newest' or 'oldest' pickup first.
const sortOrder = ref('newest')

// The open tab's orders, after the search, the Done status filter and the sort.
const TABS = [
  { key: 'needs-reply', label: 'Needs reply', list: 'needsReply' },
  { key: 'waiting-buyer', label: 'Waiting on buyer', list: 'waitingOnBuyer' },
  { key: 'upcoming', label: 'Accepted', list: 'upcoming' },
  { key: 'done', label: 'Done', list: 'done' },
]
const currentList = computed(() => {
  const tab = TABS.find((t) => t.key === activeGroup.value)
  let list = shown.value[tab.list]
  if (tab.key === 'done' && doneStatus.value !== 'all') list = list.filter((o) => o.status === doneStatus.value)
  // The server sends the oldest pickup first; reverse it for newest first.
  return sortOrder.value === 'oldest' ? list : [...list].reverse()
})
const EMPTY_TEXT = {
  'needs-reply': 'No orders waiting for your reply.',
  'waiting-buyer': 'No new times waiting on the buyer.',
  upcoming: 'No accepted orders yet.',
  done: 'No completed, declined or cancelled orders yet.',
}

// the four tiles at the top: the arrow opens the matching tab
const ordersPanel = ref(null)
function openGroup(key) {
  activeGroup.value = key
  ordersPanel.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

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

// Returns up to five accepted orders whose pickup time has not passed, soonest first.
const nextPickups = computed(() => {
  const list = []
  for (let i = 0; i < upcoming.value.length && list.length < 5; i++) { // Stop once five are found.
    if (!isOverdue(upcoming.value[i])) list.push(upcoming.value[i]) // The server already sorts soonest first.
  }
  return list
})

// bootstrap-icons paths (16x16)
const ICONS = {
  chat: 'M5 8a1 1 0 1 1-2 0 1 1 0 0 1 2 0m4 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0m3 1a1 1 0 1 0 0-2 1 1 0 0 0 0 2m-9.083 4.725a.5.5 0 0 0-.512-.45c-.416.022-.81.06-1.163.11A6.95 6.95 0 0 0 2.65 12.4C1.05 11.04 0 9.13 0 7c0-3.866 3.582-7 8-7s8 3.134 8 7-3.582 7-8 7c-1.264 0-2.46-.256-3.524-.71a.5.5 0 0 0-.32-.026c-.67.183-1.54.36-2.556.408l-.006.001a.5.5 0 0 1-.466-.668c.243-.66.432-1.31.543-1.963z',
  bag: 'M8 1a2.5 2.5 0 0 1 2.5 2.5V4h-5v-.5A2.5 2.5 0 0 1 8 1m3.5 3v-.5a3.5 3.5 0 1 0-7 0V4H1v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V4z',
  clock: 'M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0M8 3.5a.5.5 0 0 0-1 0V9a.5.5 0 0 0 .252.434l3.5 2a.5.5 0 0 0 .496-.868L8 8.71z',
  check: 'M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0m-3.97-3.03a.75.75 0 0 0-1.08.022L7.477 9.417 5.384 7.323a.75.75 0 0 0-1.06 1.06L6.97 11.03a.75.75 0 0 0 1.079-.02l3.992-4.99a.75.75 0 0 0-.01-1.05z',
  calendar: 'M3.5 0a.5.5 0 0 1 .5.5V1h8V.5a.5.5 0 0 1 1 0V1h1a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V3a2 2 0 0 1 2-2h1V.5a.5.5 0 0 1 .5-.5M1 4v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V4z',
  person: 'M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6m2-3a2 2 0 1 1-4 0 2 2 0 0 1 4 0m4 8c0 1-1 1-1 1H3s-1 0-1-1 1-4 6-4 6 3 6 4m-1-.004c-.001-.246-.154-.986-.832-1.664C11.516 10.68 10.289 10 8 10s-3.516.68-4.168 1.332c-.678.678-.83 1.418-.832 1.664z',
  box: 'M8.186 1.113a.5.5 0 0 0-.372 0L1.846 3.5 8 5.961 14.154 3.5zM15 4.239l-6.5 2.6v7.922l6.5-2.6V4.24zM7.5 14.762V6.838L1 4.239v7.923zM7.443.184a1.5 1.5 0 0 1 1.114 0l7.129 2.852A.5.5 0 0 1 16 3.5v8.662a1 1 0 0 1-.629.928l-7.185 2.874a.5.5 0 0 1-.372 0L.63 13.09a1 1 0 0 1-.63-.928V3.5a.5.5 0 0 1 .314-.464z',
  time: 'M8 3.5a.5.5 0 0 0-1 0V9a.5.5 0 0 0 .252.434l3.5 2a.5.5 0 0 0 .496-.868L8 8.71zM8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16m7-8A7 7 0 1 1 1 8a7 7 0 0 1 14 0',
  note: 'M5 10.5a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 0 1h-2a.5.5 0 0 1-.5-.5m0-2a.5.5 0 0 1 .5-.5h5a.5.5 0 0 1 0 1h-5a.5.5 0 0 1-.5-.5m0-2a.5.5 0 0 1 .5-.5h5a.5.5 0 0 1 0 1h-5a.5.5 0 0 1-.5-.5m0-2a.5.5 0 0 1 .5-.5h5a.5.5 0 0 1 0 1h-5a.5.5 0 0 1-.5-.5M3 0h10a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2v-1h1v1a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1H3a1 1 0 0 0-1 1v1H1V2a2 2 0 0 1 2-2',
  pin: 'M12.166 8.94c-.524 1.062-1.234 2.12-1.96 3.07A32 32 0 0 1 8 14.58a32 32 0 0 1-2.206-2.57c-.726-.95-1.436-2.008-1.96-3.07C3.304 7.867 3 6.862 3 6a5 5 0 0 1 10 0c0 .862-.305 1.867-.834 2.94M8 16s6-5.686 6-10A6 6 0 0 0 2 6c0 4.314 6 10 6 10m0-8a2 2 0 1 1 0-4 2 2 0 0 1 0 4m0 1a3 3 0 1 0 0-6 3 3 0 0 0 0 6',
}
const statTiles = computed(() => [
  { key: 'accepted', tone: 'blue', icon: ICONS.bag, label: 'Accepted', value: upcoming.value.length, hint: 'Pickups coming up', group: 'upcoming', testid: 'stat-upcoming' },
  { key: 'needs', tone: 'amber', icon: ICONS.chat, label: 'Needs reply', value: needsReply.value.length, hint: 'Waiting for your answer', group: 'needs-reply', testid: 'stat-needs-reply' },
  { key: 'overdue', tone: 'rose', icon: ICONS.clock, label: 'Overdue', value: overdueCount.value, hint: 'Pickup time has passed', group: 'upcoming', testid: 'stat-overdue' },
  { key: 'active', tone: 'green', icon: ICONS.check, label: 'Total active', value: totalActive.value, hint: 'Not completed yet', group: 'needs-reply', testid: 'stat-total-active' },
])

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

// Checks whether the time this order would be accepted for has already passed.
function timePassed(order) {
  let time = order.requestedTime
  if (order.status === 'rescheduled') time = order.proposedTime // A new time waits for the buyer.
  return new Date(time).getTime() < new Date().getTime()
}

// Returns a warning when a time has passed; otherwise an empty string.
function sellerHelp(order) {
  if (isOverdue(order)) return 'The pickup time has passed. Mark it completed or message the buyer.'
  if (order.status === 'pending' && timePassed(order)) return 'The pickup time has passed. Propose a new time or decline.'
  if (order.status === 'rescheduled' && timePassed(order)) return 'Your new time has passed. Message the buyer.'
  return ''
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

// Asks why the seller is declining / cancelling (shown to the buyer), then sends it.
async function askReason(order, status) {
  clearConfirm()
  proposeOpenId.value = ''
  const declining = status === 'declined'
  const reason = await reasonModal.value.ask({
    title: declining ? 'Decline this order?' : 'Cancel this order?',
    hint: 'The buyer will see this reason.',
    confirmLabel: declining ? 'Yes, decline' : 'Yes, cancel',
  })
  if (reason) updateStatus(order, status, reason)
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
    proposals.value[order._id] = '' // A reopened box starts empty.
    clearConfirm()
  }
}

// Closes the new-time input without changing an order.
function closeProposal() {
  proposeOpenId.value = ''
}

// Changes one order at a time, shows the result and refreshes the dashboard.
async function updateStatus(order, status, reason = '') {
  if (busyId.value !== '') return // Ignore another action while a request is being sent.
  message.value = ''
  error.value = ''
  busyId.value = order._id
  try {
    await axios.put(`${API_URL}/orders/${order._id}/status`, {
      status,
      userId: currentUser.value._id,
      proposedTime: proposals.value[order._id],
      reason,
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

// Sends logged-out users to login and buyers to their own orders before loading.
onMounted(() => {
  if (!currentUser.value) {
    router.push('/login')
    return
  }
  if (currentUser.value.role !== 'seller') { // Buyers see their own orders page instead.
    router.push('/orders')
    return
  }
  loadOrders()
})
</script>

<template>
  <div>
    <!-- ===== header ===== -->
    <div class="d-flex justify-content-between align-items-start flex-wrap gap-3 mb-4">
      <div>
        <h2 class="page-title mb-1">Order dashboard</h2>
        <p class="text-muted mb-0">Manage your orders and keep track of buyer requests.</p>
      </div>
      <button class="btn soft-btn" :disabled="refreshing" @click="refreshOrders" data-testid="seller-orders-refresh">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
          <path fill-rule="evenodd" d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2z" />
          <path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466" />
        </svg>
        {{ refreshing ? 'Refreshing…' : 'Refresh' }}
      </button>
    </div>

    <p v-if="loading" data-testid="seller-orders-loading">
      <span class="spinner-border spinner-border-sm"></span> Loading…
    </p>
    <div v-else-if="error && orders.length === 0" class="alert alert-danger" data-testid="seller-orders-error">{{ error }}</div>
    <template v-else>
      <!-- ===== the four numbers ===== -->
      <div class="stat-grid mb-4" data-testid="seller-dashboard-stats">
        <button v-for="t in statTiles" :key="t.key" type="button" class="stat-tile" :class="`tone-${t.tone}`"
          :aria-label="`${t.label}: ${t.value}. Show these orders`" @click="openGroup(t.group)">
          <span class="stat-icon" aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 16 16" fill="currentColor"><path :d="t.icon" /></svg>
          </span>
          <span class="stat-text">
            <span class="stat-label">{{ t.label }}</span>
            <span class="stat-value" :data-testid="t.testid">{{ t.value }}</span>
            <span class="stat-hint">{{ t.hint }}</span>
          </span>
          <span class="stat-arrow" aria-hidden="true">›</span>
        </button>
      </div>

      <div v-if="message" class="alert alert-success" data-testid="seller-orders-message">{{ message }}</div>
      <div v-if="error" class="alert alert-danger" data-testid="seller-orders-error">{{ error }}</div>
      <div v-if="chatError" class="alert alert-danger" data-testid="order-chat-error">{{ chatError }}</div>

      <div class="row g-4">
        <!-- ===== left: the orders ===== -->
        <div class="col-lg-8">
          <section ref="ordersPanel" class="panel p-3 p-md-4" aria-labelledby="orders-title">
            <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
              <h3 id="orders-title" class="panel-title mb-0">
                <svg width="22" height="22" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path :d="ICONS.calendar" /></svg>
                Orders
              </h3>
              <select v-if="orders.length > 0" v-model="sortOrder" class="form-select sort-select" aria-label="Sort orders" data-testid="done-sort">
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
              </select>
            </div>

            <p v-if="orders.length === 0" class="text-muted mb-0" data-testid="seller-orders-empty">No order requests yet.</p>
            <template v-else>
              <!-- search the order lists (long lists are easier to go through) -->
              <div class="search-field mb-3">
                <label class="visually-hidden" for="seller-order-search">Search orders</label>
                <svg class="field-icon" width="18" height="18" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                  <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001q.044.06.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1 1 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0" />
                </svg>
                <input id="seller-order-search" v-model="search" type="search" class="form-control" placeholder="Search by product, buyer or note" />
              </div>
              <p v-if="search.trim()" class="small text-muted" aria-live="polite">{{ shownCount }} {{ shownCount === 1 ? 'order' : 'orders' }} found</p>

              <!-- tabs: pills, the open one filled navy -->
              <div class="tab-pills mb-3" role="tablist" data-testid="seller-orders-tabs">
                <button v-for="t in TABS" :key="t.key" type="button" role="tab" class="tab-pill" :class="{ active: activeGroup === t.key }"
                  :aria-selected="activeGroup === t.key" @click="activeGroup = t.key" :data-testid="`seller-tab-${t.key}`">
                  {{ t.label }} ({{ shown[t.list].length }})
                </button>
              </div>

              <div v-if="activeGroup === 'done'" class="d-flex align-items-center gap-2 mb-3">
                <label class="small text-muted" for="done-status">Show</label>
                <select id="done-status" v-model="doneStatus" class="form-select form-select-sm w-auto" data-testid="done-filter-status">
                  <option value="all">All</option>
                  <option value="completed">Completed</option>
                  <option value="declined">Declined</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>

              <p v-if="currentList.length === 0" class="text-muted" data-testid="group-empty">
                {{ search.trim() || (activeGroup === 'done' && doneStatus !== 'all') ? 'No matching orders.' : EMPTY_TEXT[activeGroup] }}
              </p>

              <div v-else class="d-flex flex-column gap-3" :data-testid="`group-${activeGroup}`">
                <article v-for="o in currentList" :key="o._id" class="order-card" data-testid="order-row">
                  <div class="d-flex gap-3">
                    <img :src="imageFor(o)" :alt="o.product ? o.product.name : 'Product removed'" width="64" height="64"
                      class="order-thumb flex-shrink-0" @error="brokenImages[o._id] = true" data-testid="order-image" />
                    <div class="order-text flex-grow-1">
                      <div class="d-flex justify-content-between align-items-start gap-2">
                        <div class="d-flex align-items-center flex-wrap gap-2 order-text">
                          <h4 class="order-name text-break">{{ o.product ? o.product.name : 'Product removed' }}</h4>
                          <span v-if="isOverdue(o)" class="status-pill pill-overdue" data-testid="order-overdue">Overdue</span>
                          <span v-else class="status-pill" :class="`pill-${o.status}`" data-testid="order-status">{{ capitalize(o.status) }}</span>
                        </div>
                        <span class="order-price" data-testid="order-price">{{ formatPrice(o.totalPrice) }}</span>
                      </div>

                      <ul class="order-facts">
                        <!-- buyer, quantity and time on one line -->
                        <li class="text-break">
                          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path :d="ICONS.time" /></svg>
                          <span>{{ o.buyer ? o.buyer.name : 'Buyer removed' }} &middot; <span data-testid="order-quantity-line">Quantity: {{ o.quantity }}</span> &middot; {{ capitalize(o.fulfilment) }} &middot; {{ formatDateTime(o.requestedTime) }}</span>
                        </li>
                        <li v-if="o.fulfilment === 'delivery' && o.deliveryAddress" class="text-break" data-testid="order-delivery-to">
                          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path :d="ICONS.pin" /></svg>
                          <span>Deliver to: {{ o.deliveryAddress }}{{ o.deliveryUnit ? `, ${o.deliveryUnit}` : '' }}, Singapore {{ o.deliveryPostalCode }}</span>
                        </li>
                        <li v-if="o.customisation && o.customisation.trim()" class="text-break">
                          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path :d="ICONS.note" /></svg>
                          Note: {{ o.customisation }}
                        </li>
                      </ul>

                      <p v-if="sellerHelp(o)" class="status-help warning" data-testid="order-status-help">{{ sellerHelp(o) }}</p>
                      <p v-if="o.status === 'rescheduled'" class="status-help proposal">Proposed time: <strong>{{ formatDateTime(o.proposedTime) }}</strong></p>
                      <p v-if="(o.status === 'declined' || o.status === 'cancelled') && o.reason" class="status-help reason" data-testid="order-reason">
                        <strong>{{ o.status === 'cancelled' && o.cancelledBy === 'buyer' ? "Buyer's reason" : 'Your reason' }}:</strong> {{ o.reason }}
                      </p>
                    </div>
                  </div>

                  <!-- actions -->
                  <div class="order-actions">
                    <!-- needs reply: accept / propose / message / decline -->
                    <template v-if="o.status === 'pending'">
                      <button class="btn pill-btn btn-navy" :disabled="busyId !== '' || timePassed(o)" @click="updateStatus(o, 'accepted')" data-testid="order-accept">
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0" /></svg>
                        Accept
                      </button>
                      <button class="btn pill-btn btn-outline-brand" :disabled="busyId !== ''" @click="toggleProposal(o)" data-testid="order-propose-toggle">
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path :d="ICONS.calendar" /></svg>
                        Propose new time
                      </button>
                    </template>
                    <!-- accepted: complete / cancel -->
                    <template v-else-if="o.status === 'accepted'">
                      <button class="btn pill-btn btn-navy" :disabled="busyId !== ''" @click="askConfirm(o, 'completed')" data-testid="order-complete">
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0" /></svg>
                        Mark completed
                      </button>
                    </template>
                    <button v-if="o.buyer" class="btn pill-btn btn-text" :disabled="chatBusyId !== ''" @click="messageBuyer(o)" data-testid="order-message-buyer">
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M2.678 11.894a1 1 0 0 1 .287.801 11 11 0 0 1-.398 2c1.395-.323 2.247-.697 2.634-.893a1 1 0 0 1 .71-.074A8 8 0 0 0 8 14c3.996 0 7-2.807 7-6s-3.004-6-7-6-7 2.808-7 6c0 1.468.617 2.83 1.678 3.894m-.493 3.905a22 22 0 0 1-.713.129c-.2.032-.352-.176-.273-.362a10 10 0 0 0 .244-.637l.003-.01c.248-.72.45-1.548.524-2.319C.743 11.37 0 9.76 0 8c0-3.866 3.582-7 8-7s8 3.134 8 7-3.582 7-8 7a9 9 0 0 1-2.347-.306c-.52.263-1.639.742-3.468 1.105" /></svg>
                      Message buyer
                    </button>
                    <button v-if="o.status === 'pending'" class="btn pill-btn btn-outline-cancel ms-md-auto" :disabled="busyId !== ''" @click="askReason(o, 'declined')" data-testid="order-decline">
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M2.146 2.854a.5.5 0 1 1 .708-.708L8 7.293l5.146-5.147a.5.5 0 0 1 .708.708L8.707 8l5.147 5.146a.5.5 0 0 1-.708.708L8 8.707l-5.146 5.147a.5.5 0 0 1-.708-.708L7.293 8z" /></svg>
                      Decline
                    </button>
                    <button v-if="o.status === 'accepted'" class="btn pill-btn btn-outline-cancel ms-md-auto" :disabled="busyId !== ''" @click="askReason(o, 'cancelled')" data-testid="order-cancel">
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M2.146 2.854a.5.5 0 1 1 .708-.708L8 7.293l5.146-5.147a.5.5 0 0 1 .708.708L8.707 8l5.147 5.146a.5.5 0 0 1-.708.708L8 8.707l-5.146 5.147a.5.5 0 0 1-.708-.708L7.293 8z" /></svg>
                      Cancel
                    </button>
                  </div>

                  <!-- propose a new time -->
                  <div v-if="proposeOpenId === o._id" class="inline-box">
                    <label class="form-label small mb-1" :for="'proposed-time-' + o._id">New date and time</label>
                    <div class="d-flex flex-wrap gap-2">
                      <input type="datetime-local" class="form-control w-auto" :id="'proposed-time-' + o._id" v-model="proposals[o._id]" :disabled="busyId !== ''" data-testid="order-propose-input" />
                      <button class="btn pill-btn btn-navy" :disabled="busyId !== ''" @click="proposeTime(o)" data-testid="order-propose-submit">Send new time</button>
                    </div>
                  </div>
                  <!-- confirm completed -->
                  <div v-if="confirmId === o._id && confirmStatus === 'completed'" class="inline-box">
                    <p class="mb-2">Mark this order as completed?</p>
                    <div class="d-flex flex-wrap gap-2">
                      <button class="btn pill-btn btn-navy" :disabled="busyId !== ''" @click="updateStatus(o, 'completed')" data-testid="order-confirm-yes">Yes, completed</button>
                      <button class="btn pill-btn btn-outline-brand" :disabled="busyId !== ''" @click="clearConfirm" data-testid="order-confirm-no">Keep order</button>
                    </div>
                  </div>
                  <p v-if="busyId === o._id" class="small text-body-secondary mt-2 mb-0" data-testid="order-sending"><span class="spinner-border spinner-border-sm"></span> Sending…</p>
                </article>
              </div>
            </template>
          </section>
        </div>

        <!-- ===== right: next pickups ===== -->
        <div class="col-lg-4 d-flex flex-column gap-4">
          <section class="panel panel-headed" data-testid="next-pickup" aria-labelledby="pickups-title">
            <h3 id="pickups-title" class="panel-head">
              <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path :d="ICONS.calendar" /></svg>
              Next pickups
            </h3>
            <div class="p-3 p-md-4">
              <ul v-if="nextPickups.length > 0" class="pickup-list">
                <li v-for="p in nextPickups" :key="p._id" data-testid="next-pickup-item">
                  <span class="pickup-date">{{ formatDateTime(p.requestedTime) }}</span>
                  <span class="fw-semibold text-break">{{ p.product ? p.product.name : 'Product removed' }}</span>
                  <span class="small text-muted text-break">{{ p.buyer ? p.buyer.name : 'Buyer removed' }} &middot; {{ capitalize(p.fulfilment) }}</span>
                </li>
              </ul>
              <div v-else class="empty-pickups">
                <span class="empty-icon" aria-hidden="true">
                  <svg width="40" height="40" viewBox="0 0 16 16" fill="currentColor"><path :d="ICONS.calendar" /></svg>
                </span>
                <p class="fw-semibold mb-1">No upcoming pickups</p>
                <p class="small text-muted mb-0">Accepted orders will appear here.</p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </template>
  </div>
  <ReasonModal ref="reasonModal" />
</template>

<style scoped>
/* ---------- the four tiles: soft colour + a wave in the corner ---------- */
.stat-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 1rem;
}
.stat-tile {
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: 0.9rem;
  padding: 1.1rem 1.1rem 1.4rem;
  overflow: hidden;
  border: 1px solid var(--tile-line);
  border-radius: 1.25rem;
  background: linear-gradient(135deg, var(--tile-from), var(--tile-to));
  text-align: left;
  color: var(--ink);
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}
.stat-tile::after { /* the wave */
  content: '';
  position: absolute;
  right: -20%;
  bottom: -55%;
  width: 80%;
  height: 90%;
  border-radius: 50%;
  background: var(--tile-wave);
  pointer-events: none;
}
.stat-tile:hover,
.stat-tile:focus-visible {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(var(--navy-rgb), 0.08);
}
.tone-amber { --tile-from: #fff8ea; --tile-to: #fdeccb; --tile-line: #f8e2b4; --tile-wave: rgba(var(--amber-rgb), 0.18); }
.tone-blue  { --tile-from: #f4f8fe; --tile-to: #e3ecf9; --tile-line: #d8e4f5; --tile-wave: rgba(var(--aqua-rgb), 0.2); }
.tone-rose  { --tile-from: #fff3f4; --tile-to: #fbe0e3; --tile-line: #f6d2d6; --tile-wave: rgba(var(--rose-rgb), 0.14); }
.tone-green { --tile-from: #f1faf5; --tile-to: #dcf1e5; --tile-line: #c9e8d6; --tile-wave: rgba(35, 128, 74, 0.14); }
.stat-icon {
  position: relative;
  z-index: 1;
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 52px;
  height: 52px;
  border-radius: 50%;
  background: #fff;
  color: var(--navy);
  box-shadow: 0 2px 8px rgba(var(--navy-rgb), 0.08);
}
.tone-green .stat-icon { color: #23804a; }
.stat-text {
  position: relative;
  z-index: 1;
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
}
.stat-label { font-weight: 600; }
.tone-green .stat-label { color: #23804a; }
.stat-value {
  font-size: 2rem;
  font-weight: 700;
  line-height: 1.15;
  color: var(--navy);
}
.stat-hint { font-size: 0.85rem; color: var(--ink-soft); }
.stat-arrow {
  position: relative;
  z-index: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.85);
  font-size: 1.3rem;
  line-height: 1;
  color: var(--navy);
}

/* ---------- panels ---------- */
.panel {
  border: 1px solid var(--line);
  border-radius: 1.25rem;
  background: var(--surface);
  box-shadow: 0 4px 16px rgba(var(--navy-rgb), 0.04);
}
.panel-title {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--navy);
}
.sort-select {
  width: auto;
  min-width: 170px;
  border-radius: 999px;
}

/* search (same as My orders) */
.search-field { position: relative; }
.field-icon {
  position: absolute;
  top: 50%;
  left: 1rem;
  transform: translateY(-50%);
  color: var(--muted);
  pointer-events: none;
}
.search-field .form-control {
  height: 48px;
  padding-left: 2.8rem;
  border-radius: 999px;
}

/* tabs: pills, the open one filled navy */
.tab-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
}
.tab-pill {
  padding: 0.55rem 1.2rem;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: var(--aqua-soft);
  font-weight: 500;
  color: var(--navy);
}
.tab-pill:hover { background: var(--tile-hover); }
.tab-pill.active {
  border-color: var(--navy);
  background: var(--navy);
  color: #fff;
}

/* ---------- order cards (same look as My orders) ---------- */
.order-card {
  padding: 1rem 1.25rem;
  border: 1px solid var(--line);
  border-radius: 1.25rem;
  background: var(--surface);
}
.order-thumb {
  width: 64px;
  height: 64px;
  border-radius: 0.8rem;
  object-fit: cover;
}
.order-text { min-width: 0; }
.order-name {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--ink);
}
.order-price {
  flex-shrink: 0;
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--ink);
}
.status-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.3rem 0.85rem;
  border-radius: 999px;
  font-size: 0.85rem;
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

.order-facts {
  margin: 0.4rem 0 0;
  padding: 0;
  list-style: none;
}
.order-facts li {
  display: flex;
  align-items: flex-start;
  gap: 0.65rem;
  margin-bottom: 0.25rem;
  color: var(--ink);
}
.order-facts svg {
  flex-shrink: 0;
  margin-top: 0.2rem;
  color: var(--ink-soft);
}
.status-help {
  margin: 0.4rem 0 0;
  padding: 0.6rem 0.9rem;
  border-radius: 0.8rem;
  background: var(--surface-soft);
  font-size: 0.9rem;
  color: var(--ink-soft);
}
/* Passed times need a clear warning. */
.status-help.warning {
  background: rgba(var(--rose-rgb), 0.08);
  color: #b8312f;
}
.status-help.proposal {
  background: var(--aqua-soft);
  color: var(--ink);
}
.status-help.reason { /* why the order was declined / cancelled */
  background: rgba(var(--rose-rgb), 0.08);
  color: var(--ink);
  overflow-wrap: anywhere;
}

.order-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.6rem;
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--line);
}
.pill-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.55rem 1.3rem;
  border-radius: 999px;
  font-weight: 600;
}
.btn-navy {
  border: 1.5px solid var(--navy);
  background: var(--navy);
  color: #fff;
}
.btn-navy:hover,
.btn-navy:focus-visible {
  border-color: var(--ocean-dark);
  background: var(--ocean-dark);
  color: #fff;
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
.btn-text {
  border: 0;
  background: none;
  color: var(--navy);
}
.btn-text:hover { background: var(--ocean-soft); color: var(--navy); }
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
.inline-box {
  margin-top: 0.9rem;
  padding: 0.9rem 1rem;
  border-radius: 0.9rem;
  background: var(--surface-soft);
}

/* Panel with a navy header strip (Next pickups). */
.panel-headed { overflow: hidden; }
.panel-head {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  margin: 0;
  padding: 1rem 1.25rem;
  background: var(--navy);
  font-size: 1.25rem;
  font-weight: 600;
  color: #fff;
}

.pickup-list {
  margin: 0;
  padding: 0;
  list-style: none;
}
.pickup-list li {
  display: flex;
  flex-direction: column;
  padding: 0.65rem 0;
  border-top: 1px solid var(--line);
}
.pickup-list li:first-child { border-top: 0; padding-top: 0; }
.pickup-date {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--ocean);
}
.empty-pickups {
  padding: 1rem 0 0.5rem;
  text-align: center;
  color: var(--ink);
}
.empty-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 76px;
  height: 76px;
  margin-bottom: 0.75rem;
  border-radius: 50%;
  background: var(--aqua-soft);
  color: var(--ocean);
}

/* ---------- smaller screens ---------- */
@media (max-width: 991.98px) {
  .stat-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 575.98px) {
  .stat-grid { grid-template-columns: 1fr; }
  .order-card { padding: 0.9rem; }
  .order-thumb { width: 56px; height: 56px; }
  .order-price { font-size: 1.1rem; }
}
</style>
