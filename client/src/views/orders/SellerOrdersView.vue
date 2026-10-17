<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'
import { API_URL } from '@/utils/config'
import { currentUser } from '@/utils/auth'
import { ORDER_STATUS_BADGE } from '@/utils/constants'
import { formatPrice, formatDateTime } from '@/utils/format'

// Owner: Basile - seller's order dashboard: accept / decline / propose new time / complete
const router = useRouter()
const orders = ref([])
const proposals = ref({}) // { orderId: 'new datetime' } - one input per order
const loading = ref(true)
const error = ref('')
const showDone = ref(false)
const shop = ref(null)
const message = ref('')
const busyId = ref('')
const confirmId = ref('')
const confirmStatus = ref('')

// Groups pending orders that need the seller's reply.
const needsReply = computed(() => {
  const groupedOrders = []
  for (let i = 0; i < orders.value.length; i++) {
    const order = orders.value[i]
    if (order.status === 'pending') groupedOrders.push(order) // R22: Needs reply includes pending orders.
  }
  return groupedOrders
})

// Groups proposed times that are waiting for the buyer.
const waitingOnBuyer = computed(() => {
  const groupedOrders = []
  for (let i = 0; i < orders.value.length; i++) {
    const order = orders.value[i]
    if (order.status === 'rescheduled') groupedOrders.push(order) // R22: Waiting on buyer includes rescheduled orders.
  }
  return groupedOrders
})

// Groups accepted orders, including overdue pickups.
const upcoming = computed(() => {
  const groupedOrders = []
  for (let i = 0; i < orders.value.length; i++) {
    const order = orders.value[i]
    if (order.status === 'accepted') groupedOrders.push(order) // R22: Upcoming includes all accepted orders.
  }
  return groupedOrders
})

// Groups orders that have reached a final status.
const done = computed(() => {
  const groupedOrders = []
  for (let i = 0; i < orders.value.length; i++) {
    const order = orders.value[i]
    if (order.status === 'completed' || order.status === 'declined' || order.status === 'cancelled') groupedOrders.push(order) // R22: Done includes the three final statuses.
  }
  return groupedOrders
})

// Counts accepted orders whose pickup time has passed.
const overdueCount = computed(() => {
  let count = 0
  for (let i = 0; i < upcoming.value.length; i++) {
    if (isOverdue(upcoming.value[i])) count++ // R20: overdue orders remain in Upcoming.
  }
  return count
})

// Counts current orders without including any final statuses.
const totalActive = computed(() => {
  let count = 0
  for (let i = 0; i < orders.value.length; i++) {
    const order = orders.value[i]
    if (order.status === 'pending' || order.status === 'rescheduled' || order.status === 'accepted') count++ // R22: current orders only.
  }
  return count
})

// Uses the server's error message, or a general message if none is available.
function getErrorMessage(err) {
  if (err.response && err.response.data && err.response.data.message) {
    return err.response.data.message
  }
  return 'Something went wrong. Please try again.'
}

// Checks whether an accepted order's requested time has passed.
function isOverdue(order) {
  return order.status === 'accepted' && new Date(order.requestedTime).getTime() < new Date().getTime() // R20: only accepted orders can be overdue.
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

// Stores the order and action that need the seller's confirmation.
function askConfirm(order, status) {
  confirmId.value = order._id
  confirmStatus.value = status
}

// Closes the confirmation without changing an order.
function clearConfirm() {
  confirmId.value = ''
  confirmStatus.value = ''
}

// Changes one order at a time, shows the result and refreshes the dashboard.
async function updateStatus(order, status) {
  if (busyId.value !== '') return // R11: ignore another action while a request is being sent.
  message.value = ''
  error.value = ''
  busyId.value = order._id
  try {
    await axios.put(`${API_URL}/orders/${order._id}/status`, {
      status,
      userId: currentUser.value._id,
      proposedTime: proposals.value[order._id],
    })
    if (status === 'accepted') message.value = 'Order accepted.' // R13: explain the accepted order.
    if (status === 'declined') message.value = 'Order declined.' // R13: explain the declined order.
    if (status === 'rescheduled') message.value = 'New time sent to the buyer.' // R13: explain the proposed time.
    if (status === 'completed') message.value = 'Order marked as completed.' // R13: explain the completed order.
    if (status === 'cancelled') message.value = 'Order cancelled.' // R13: explain the cancelled order.
    clearConfirm()
    busyId.value = ''
    await loadOrders()
  } catch (err) {
    error.value = getErrorMessage(err)
    clearConfirm()
    busyId.value = ''
    await loadOrders()
  }
}

// Checks the proposed time before sending it to the buyer.
async function proposeTime(order) {
  message.value = ''
  error.value = ''
  const proposedTime = proposals.value[order._id]
  if (!proposedTime) { // R7: a proposal needs a date and time.
    error.value = 'Pick a date and time first.'
    return
  }
  if (!(new Date().getTime() < new Date(proposedTime).getTime())) { // R7: the proposed time must be later than now.
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
      <h2 class="mb-3">Order dashboard</h2>
      <p v-if="loading" data-testid="seller-orders-loading">
        <span class="spinner-border spinner-border-sm"></span> Loading...
      </p>
      <div v-else-if="error && orders.length === 0" class="alert alert-danger" data-testid="seller-orders-error">{{ error }}</div>
      <template v-else>
        <div class="row g-2 mb-4" data-testid="seller-dashboard-stats">
          <div class="col-6 col-lg-3">
            <div class="card"><div class="card-body">
              <p class="fs-3 fw-bold mb-1" data-testid="stat-needs-reply">{{ needsReply.length }}</p>
              <p class="mb-0">Needs reply</p>
            </div></div>
          </div>
          <div class="col-6 col-lg-3">
            <div class="card"><div class="card-body">
              <p class="fs-3 fw-bold mb-1" data-testid="stat-upcoming">{{ upcoming.length }}</p>
              <p class="mb-0">Upcoming</p>
            </div></div>
          </div>
          <div class="col-6 col-lg-3">
            <div class="card"><div class="card-body">
              <p class="fs-3 fw-bold mb-1" data-testid="stat-overdue">{{ overdueCount }}</p>
              <p class="mb-0">Overdue</p>
            </div></div>
          </div>
          <div class="col-6 col-lg-3">
            <div class="card"><div class="card-body">
              <p class="fs-3 fw-bold mb-1" data-testid="stat-total-active">{{ totalActive }}</p>
              <p class="mb-0">Total active</p>
            </div></div>
          </div>
        </div>
        <div v-if="message" class="alert alert-success" data-testid="seller-orders-message">{{ message }}</div>
        <div v-if="error" class="alert alert-danger" data-testid="seller-orders-error">{{ error }}</div>
        <p v-if="orders.length === 0" class="text-muted" data-testid="seller-orders-empty">No order requests yet.</p>
        <template v-else>
          <div class="mb-4" data-testid="group-needs-reply">
            <h3>Needs reply ({{ needsReply.length }})</h3>
            <p v-if="needsReply.length === 0" data-testid="group-empty">Nothing here.</p>
            <div v-else class="row g-3">
              <div v-for="o in needsReply" :key="o._id" class="col-12 col-lg-6">
                <div class="card" data-testid="order-row">
                  <div class="card-body">
                    <div class="d-flex justify-content-between flex-wrap gap-2">
                      <h5>{{ o.product ? o.product.name : 'Product removed' }} x {{ o.quantity }}</h5>
                      <span class="badge align-self-start" :class="ORDER_STATUS_BADGE[o.status]" data-testid="order-status">{{ o.status }}</span>
                    </div>
                    <p class="mb-1 text-muted">{{ o.buyer ? o.buyer.name : 'Buyer removed' }} &middot; {{ o.fulfilment }} &middot; {{ formatPrice(o.totalPrice) }}</p>
                    <p class="mb-1">Requested time: {{ formatDateTime(o.requestedTime) }}</p>
                    <p v-if="o.customisation" class="mb-2">Note: {{ o.customisation }}</p>
                    <div class="d-flex flex-wrap gap-2">
                      <button class="btn btn-sm btn-success" :disabled="busyId !== ''" @click="updateStatus(o, 'accepted')" data-testid="order-accept">Accept</button>
                      <button class="btn btn-sm btn-outline-danger" :disabled="busyId !== ''" @click="askConfirm(o, 'declined')" data-testid="order-decline">Decline</button>
                    </div>
                    <div class="mt-2">
                      <label class="form-label" :for="'proposed-time-' + o._id">Propose new time</label>
                      <input type="datetime-local" class="form-control form-control-sm" :id="'proposed-time-' + o._id" v-model="proposals[o._id]" :disabled="busyId !== ''" data-testid="order-propose-input" />
                      <div class="d-flex flex-wrap gap-2 mt-2">
                        <button class="btn btn-sm btn-outline-secondary" :disabled="busyId !== ''" @click="proposeTime(o)" data-testid="order-propose-submit">Propose new time</button>
                      </div>
                    </div>
                    <div v-if="confirmId === o._id" class="mt-2">
                      <p class="mb-1">Are you sure?</p>
                      <div class="d-flex flex-wrap gap-2">
                        <button class="btn btn-sm btn-outline-danger" :disabled="busyId !== ''" @click="updateStatus(o, confirmStatus)" data-testid="order-confirm-yes">Yes</button>
                        <button class="btn btn-sm btn-outline-secondary" :disabled="busyId !== ''" @click="clearConfirm" data-testid="order-confirm-no">No</button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="mb-4" data-testid="group-waiting-buyer">
            <h3>Waiting on buyer ({{ waitingOnBuyer.length }})</h3>
            <p v-if="waitingOnBuyer.length === 0" data-testid="group-empty">Nothing here.</p>
            <div v-else class="row g-3">
              <div v-for="o in waitingOnBuyer" :key="o._id" class="col-12 col-lg-6">
                <div class="card" data-testid="order-row">
                  <div class="card-body">
                    <div class="d-flex justify-content-between flex-wrap gap-2">
                      <h5>{{ o.product ? o.product.name : 'Product removed' }} x {{ o.quantity }}</h5>
                      <span class="badge align-self-start" :class="ORDER_STATUS_BADGE[o.status]" data-testid="order-status">{{ o.status }}</span>
                    </div>
                    <p class="mb-1 text-muted">{{ o.buyer ? o.buyer.name : 'Buyer removed' }} &middot; {{ o.fulfilment }} &middot; {{ formatPrice(o.totalPrice) }}</p>
                    <p class="mb-1">Requested time: {{ formatDateTime(o.requestedTime) }}</p>
                    <p v-if="o.customisation" class="mb-2">Note: {{ o.customisation }}</p>
                    <p class="mb-0 text-muted">Waiting for the buyer to accept {{ formatDateTime(o.proposedTime) }}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="mb-4" data-testid="group-upcoming">
            <h3>Upcoming ({{ upcoming.length }})</h3>
            <p v-if="upcoming.length === 0" data-testid="group-empty">Nothing here.</p>
            <div v-else class="row g-3">
              <div v-for="o in upcoming" :key="o._id" class="col-12 col-lg-6">
                <div class="card" data-testid="order-row">
                  <div class="card-body">
                    <div class="d-flex justify-content-between flex-wrap gap-2">
                      <h5>{{ o.product ? o.product.name : 'Product removed' }} x {{ o.quantity }}</h5>
                      <div class="d-flex flex-wrap gap-2 align-self-start">
                        <span class="badge align-self-start" :class="ORDER_STATUS_BADGE[o.status]" data-testid="order-status">{{ o.status }}</span>
                        <span v-if="isOverdue(o)" class="badge bg-danger" data-testid="order-overdue">Overdue</span>
                      </div>
                    </div>
                    <p class="mb-1 text-muted">{{ o.buyer ? o.buyer.name : 'Buyer removed' }} &middot; {{ o.fulfilment }} &middot; {{ formatPrice(o.totalPrice) }}</p>
                    <p class="mb-1">Requested time: {{ formatDateTime(o.requestedTime) }}</p>
                    <p v-if="o.customisation" class="mb-2">Note: {{ o.customisation }}</p>
                    <div class="d-flex flex-wrap gap-2">
                      <button class="btn btn-sm btn-brand" :disabled="busyId !== ''" @click="updateStatus(o, 'completed')" data-testid="order-complete">Mark completed</button>
                      <button class="btn btn-sm btn-outline-danger" :disabled="busyId !== ''" @click="askConfirm(o, 'cancelled')" data-testid="order-cancel">Cancel</button>
                    </div>
                    <div v-if="confirmId === o._id" class="mt-2">
                      <p class="mb-1">Are you sure?</p>
                      <div class="d-flex flex-wrap gap-2">
                        <button class="btn btn-sm btn-outline-danger" :disabled="busyId !== ''" @click="updateStatus(o, confirmStatus)" data-testid="order-confirm-yes">Yes</button>
                        <button class="btn btn-sm btn-outline-secondary" :disabled="busyId !== ''" @click="clearConfirm" data-testid="order-confirm-no">No</button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="mb-4" data-testid="group-done">
            <h3>Done ({{ done.length }})</h3>
            <div class="d-flex flex-wrap gap-2 mb-3">
              <button class="btn btn-sm btn-outline-secondary" @click="showDone = !showDone" data-testid="group-done-toggle">{{ showDone ? 'Hide done orders' : 'Show done orders (' + done.length + ')' }}</button>
            </div>
            <template v-if="showDone">
              <p v-if="done.length === 0" data-testid="group-empty">Nothing here.</p>
              <div v-else class="row g-3">
                <div v-for="o in done" :key="o._id" class="col-12 col-lg-6">
                  <div class="card" data-testid="order-row">
                    <div class="card-body">
                      <div class="d-flex justify-content-between flex-wrap gap-2">
                        <h5>{{ o.product ? o.product.name : 'Product removed' }} x {{ o.quantity }}</h5>
                        <span class="badge align-self-start" :class="ORDER_STATUS_BADGE[o.status]" data-testid="order-status">{{ o.status }}</span>
                      </div>
                      <p class="mb-1 text-muted">{{ o.buyer ? o.buyer.name : 'Buyer removed' }} &middot; {{ o.fulfilment }} &middot; {{ formatPrice(o.totalPrice) }}</p>
                      <p class="mb-1">Requested time: {{ formatDateTime(o.requestedTime) }}</p>
                      <p v-if="o.customisation" class="mb-2">Note: {{ o.customisation }}</p>
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
