<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'
import { API_URL } from '@/utils/config'
import { currentUser } from '@/utils/auth'
import { ORDER_STATUS_BADGE } from '@/utils/constants'
import { formatPrice, formatDateTime } from '@/utils/format'

// Owner: Basile - buyer's order dashboard
const router = useRouter()
const orders = ref([])

async function loadOrders() {
  try {
    const response = await axios.get(`${API_URL}/orders/buyer/${currentUser.value._id}`)
    orders.value = response.data
  } catch (error) {
    console.log(error.message)
  }
}

async function updateStatus(order, status) {
  try {
    await axios.put(`${API_URL}/orders/${order._id}/status`, { status, actor: 'buyer' })
    await loadOrders()
  } catch (error) {
    console.log(error.message)
  }
}

onMounted(() => {
  if (!currentUser.value) {
    router.push('/login')
    return
  }
  loadOrders()
})
</script>

<template>
  <div>
    <h2 class="mb-3">My orders</h2>
    <p v-if="orders.length === 0" class="text-muted">No orders yet.</p>

    <div v-for="o in orders" :key="o._id" class="card mb-3">
      <div class="card-body">
        <div class="d-flex justify-content-between">
          <h5>{{ o.product?.name }} x {{ o.quantity }}</h5>
          <span class="badge align-self-start" :class="ORDER_STATUS_BADGE[o.status]">{{ o.status }}</span>
        </div>
        <p class="mb-1 text-muted">{{ o.shop?.name }} &middot; {{ o.fulfilment }} &middot; {{ formatPrice(o.totalPrice) }}</p>
        <p class="mb-1">Time: {{ formatDateTime(o.requestedTime) }}</p>
        <p v-if="o.customisation" class="mb-1">Note: {{ o.customisation }}</p>

        <div v-if="o.status === 'rescheduled'" class="alert alert-info py-2 mt-2">
          Seller suggests a new time: <strong>{{ formatDateTime(o.proposedTime) }}</strong>
          <button class="btn btn-sm btn-success ms-2" @click="updateStatus(o, 'accepted')">Accept</button>
          <button class="btn btn-sm btn-outline-danger ms-1" @click="updateStatus(o, 'cancelled')">Cancel order</button>
        </div>

        <button
          v-if="o.status === 'pending' || o.status === 'accepted'"
          class="btn btn-sm btn-outline-danger"
          @click="updateStatus(o, 'cancelled')"
        >
          Cancel
        </button>
        <RouterLink v-if="o.status === 'completed'" :to="`/review/${o._id}`" class="btn btn-sm btn-brand">Leave a review</RouterLink>
      </div>
    </div>
  </div>
</template>
