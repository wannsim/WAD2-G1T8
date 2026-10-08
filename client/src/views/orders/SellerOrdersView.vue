<script setup>
import { ref, onMounted } from 'vue'
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

async function loadOrders() {
  try {
    const shopResponse = await axios.get(`${API_URL}/shops/mine/${currentUser.value._id}`)
    if (!shopResponse.data) {
      router.push('/seller/shop')
      return
    }
    const response = await axios.get(`${API_URL}/orders/shop/${shopResponse.data._id}`)
    orders.value = response.data
  } catch (error) {
    console.log(error.message)
  }
}

async function updateStatus(order, status) {
  try {
    await axios.put(`${API_URL}/orders/${order._id}/status`, {
      status,
      actor: 'seller',
      proposedTime: proposals.value[order._id],
    })
    await loadOrders()
  } catch (error) {
    console.log(error.message)
  }
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
  <div>
    <h2 class="mb-3">Shop orders</h2>
    <p v-if="orders.length === 0" class="text-muted">No order requests yet.</p>

    <div v-for="o in orders" :key="o._id" class="card mb-3">
      <div class="card-body">
        <div class="d-flex justify-content-between">
          <h5>{{ o.product?.name }} x {{ o.quantity }}</h5>
          <span class="badge align-self-start" :class="ORDER_STATUS_BADGE[o.status]">{{ o.status }}</span>
        </div>
        <p class="mb-1 text-muted">{{ o.buyer?.name }} &middot; {{ o.fulfilment }} &middot; {{ formatPrice(o.totalPrice) }}</p>
        <p class="mb-1">Requested time: {{ formatDateTime(o.requestedTime) }}</p>
        <p v-if="o.customisation" class="mb-2">Note: {{ o.customisation }}</p>

        <div v-if="o.status === 'pending'">
          <button class="btn btn-sm btn-success me-2" @click="updateStatus(o, 'accepted')">Accept</button>
          <button class="btn btn-sm btn-outline-danger me-2" @click="updateStatus(o, 'declined')">Decline</button>
          <div class="input-group input-group-sm mt-2" style="max-width: 420px">
            <input type="datetime-local" class="form-control" v-model="proposals[o._id]" />
            <button class="btn btn-outline-secondary" @click="updateStatus(o, 'rescheduled')">Propose new time</button>
          </div>
        </div>

        <div v-else-if="o.status === 'accepted'">
          <button class="btn btn-sm btn-brand me-2" @click="updateStatus(o, 'completed')">Mark completed</button>
          <button class="btn btn-sm btn-outline-danger" @click="updateStatus(o, 'cancelled')">Cancel</button>
        </div>

        <p v-else-if="o.status === 'rescheduled'" class="mb-0 text-muted">
          Waiting for buyer to accept {{ formatDateTime(o.proposedTime) }}
        </p>
      </div>
    </div>
  </div>
</template>
