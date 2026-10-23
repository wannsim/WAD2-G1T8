<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'
import { API_URL } from '@/utils/config'
import { currentUser, saveUser } from '@/utils/auth'
import { CATEGORIES } from '@/utils/constants'
 
// Save as: client/src/views/auth/BuyerProfileView.vue   (Owner: Wan Sim)
// The buyer's profile page (shown at /profile when the logged-in user is a buyer).
const router = useRouter()
const name = ref('')
const email = ref('')
const preferences = ref([])
const preferredMrt = ref('')
const purchases = ref([])
const followedShops = ref([])
const loadingActivity = ref(true)
const message = ref('')
 
onMounted(async () => {
  if (!currentUser.value) {
    router.push('/login') // access control: must be logged in
    return
  }
  try {
    const response = await axios.get(`${API_URL}/users/${currentUser.value._id}`)
    name.value = response.data.name
    email.value = response.data.email
    preferences.value = response.data.preferences
    preferredMrt.value = response.data.preferredMrt || ''
    const [ordersResponse, followedResponse] = await Promise.all([
      axios.get(`${API_URL}/orders/buyer/${currentUser.value._id}`),
      axios.get(`${API_URL}/shops/following/${currentUser.value._id}`),
    ])
    purchases.value = ordersResponse.data.filter((order) => order.status === 'completed')
    followedShops.value = followedResponse.data
  } catch (error) {
    message.value = error.message
  } finally {
    loadingActivity.value = false
  }
})
 
async function save() {
  try {
    const response = await axios.put(`${API_URL}/users/${currentUser.value._id}`, {
      name: name.value,
      preferences: preferences.value,
      preferredMrt: preferredMrt.value,
    })
    saveUser(response.data) // keep the saved login + NavBar in sync
    message.value = 'Profile saved!'
  } catch (error) {
    message.value = error.message
  }
}
</script>
 
<template>
  <div class="page-narrow">
      <h2 class="page-title">My profile</h2>
      <div v-if="message" class="alert alert-info">{{ message }}</div>
      <section class="card p-4 shadow-sm mb-4">
        <div class="row g-3 mb-3">
          <div class="col-12 col-sm-6">
            <label class="form-label" for="buyer-name">Name</label>
            <input id="buyer-name" type="text" class="form-control" v-model.trim="name" />
          </div>
          <div class="col-12 col-sm-6">
            <label class="form-label" for="buyer-email">Email</label>
            <input id="buyer-email" type="email" class="form-control" :value="email" disabled />
          </div>
        </div>

        <div class="mb-3">
          <label for="preferred-mrt" class="form-label">Preferred MRT station</label>
          <input id="preferred-mrt" v-model.trim="preferredMrt" class="form-control" placeholder="e.g. Bishan" />
          <!-- <div class="form-text">The map opens at this station when you switch from Browse.</div> -->
        </div>

        <div class="mb-3">
          <label class="form-label">What are you interested in?</label>
          <div class="interest-grid">
            <div v-for="category in CATEGORIES" :key="category" class="form-check">
              <input class="form-check-input" type="checkbox" :id="category" :value="category" v-model="preferences" />
              <label class="form-check-label" :for="category">{{ category }}</label>
            </div>
          </div>
        </div>

        <button class="btn btn-primary w-100" @click="save">Save profile</button>
      </section>

      <section class="card p-4 shadow-sm mb-4">
        <div class="d-flex justify-content-between align-items-end mb-2">
          <div><h3 class="h5 mb-1">Past purchases</h3><p class="small text-muted mb-0">Completed orders</p></div>
          <RouterLink to="/orders" class="small">View orders</RouterLink>
        </div>
        <p v-if="loadingActivity" class="text-muted small">Loading purchases...</p>
        <p v-else-if="purchases.length === 0" class="text-muted small">No completed purchases yet.</p>
        <div v-else class="horizontal-list">
          <RouterLink v-for="order in purchases" :key="order._id" :to="order.product ? `/products/${order.product._id}` : '/orders'" class="purchase-card">
            <strong class="d-block clamp-1">{{ order.product?.name || 'Product removed' }}</strong>
            <span class="small text-muted d-block clamp-1">{{ order.shop?.name || 'Shop removed' }}</span>
            <span class="small d-block mt-2">{{ order.totalPrice != null ? `$${Number(order.totalPrice).toFixed(2)}` : 'Completed' }}</span>
          </RouterLink>
        </div>
      </section>

      <section class="card p-4 shadow-sm mb-5">
        <h3 class="h5 mb-2">Shops you follow</h3>
        <p v-if="loadingActivity" class="text-muted small">Loading followed shops...</p>
        <p v-else-if="followedShops.length === 0" class="text-muted small">You are not following any shops yet.</p>
        <div v-else class="followed-list">
          <RouterLink v-for="shop in followedShops" :key="shop._id" :to="`/shops/${shop._id}`" class="followed-shop">
            <span><strong class="d-block">{{ shop.name }}</strong><small class="text-muted">{{ shop.nearestMrt ? `${shop.nearestMrt} MRT` : 'MRT not specified' }}</small></span>
            <span class="small text-muted">{{ shop.stats?.followerCount || 0 }} followers</span>
          </RouterLink>
        </div>
      </section>
  </div>
</template>

<style scoped>
.interest-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  column-gap: 2rem;
  row-gap: 0.4rem;
}
.horizontal-list {
  display: flex;
  gap: 0.75rem;
  overflow-x: auto;
  padding: 0.25rem 0 0.75rem;
  scroll-snap-type: x mandatory;
}
.purchase-card {
  flex: 0 0 210px;
  min-height: 110px;
  padding: 1rem;
  border: 1px solid #ece6dc;
  border-radius: 1rem;
  background: #fff;
  color: inherit;
  text-decoration: none;
  scroll-snap-align: start;
}
.purchase-card:hover, .followed-shop:hover { border-color: var(--brand); background: #fcfaf7; }
.followed-list { display: grid; gap: 0.5rem; }
.followed-shop {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.75rem 1rem;
  border: 1px solid #ece6dc;
  border-radius: 0.8rem;
  color: inherit;
  text-decoration: none;
}
</style>
