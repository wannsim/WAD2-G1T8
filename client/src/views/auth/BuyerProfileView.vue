<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'
import { API_URL } from '@/utils/config'
import { currentUser, saveUser } from '@/utils/auth'
import { CATEGORIES } from '@/utils/constants'
import { userAvatarUrl } from '@/utils/layout'
import AvatarEditor from '@/components/AvatarEditor.vue'
import CategoryMultiSelect from '@/components/CategoryMultiSelect.vue'
import MrtSelect from '@/components/MrtSelect.vue'
import { matchStation } from '@/utils/mrtStations'
import { useNameCheck } from '@/utils/nameCheck'
 
// Save as: client/src/views/auth/BuyerProfileView.vue   (Owner: Wan Sim)
// The buyer's profile page (shown at /profile when the logged-in user is a buyer).
const router = useRouter()
const name = ref('')
const email = ref('')
const preferences = ref([])
const preferredMrt = ref('')
const deliveryAddress = ref('')
const deliveryUnit = ref('')
const deliveryPostalCode = ref('')
const purchases = ref([])
const followedShops = ref([])
const loadingActivity = ref(true)
const message = ref('')
const photoError = ref('')
// the page opens read-only; "Edit profile" shows the form, Save / Cancel go back to viewing
const editing = ref(false)
// ✓ / ✗ under the Name box while typing (keeping your own name shows nothing)
const { nameStatus, nameMessage } = useNameCheck(name, {
  exceptId: () => currentUser.value?._id,
  unchanged: () => currentUser.value?.name,
})

// puts a saved user into the form (on load, and on Cancel to throw away unsaved changes)
function fillForm(user) {
  name.value = user.name
  email.value = user.email
  preferences.value = (user.preferences || []).filter((c) => CATEGORIES.includes(c)) // only ones still in the list
  preferredMrt.value = user.preferredMrt || ''
  deliveryAddress.value = user.deliveryAddress || ''
  deliveryUnit.value = user.deliveryUnit || ''
  deliveryPostalCode.value = user.deliveryPostalCode || ''
}
function startEditing() {
  message.value = ''
  editing.value = true
}
function cancelEditing() {
  fillForm(currentUser.value)
  message.value = ''
  photoError.value = ''
  editing.value = false
}
// view mode: the address on one line ('' if none)
const fullAddress = computed(() => [
  deliveryAddress.value,
  deliveryUnit.value,
  deliveryPostalCode.value ? 'Singapore ' + deliveryPostalCode.value : '',
].filter(Boolean).join(', '))

onMounted(async () => {
  if (!currentUser.value) {
    router.push('/login') // access control: must be logged in
    return
  }
  try {
    const response = await axios.get(`${API_URL}/users/${currentUser.value._id}`)
    fillForm(response.data)
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
  if (nameStatus.value === 'taken') {
    message.value = 'That username is taken. Please choose another one.'
    return
  }
  // preferred MRT is optional, but if filled in it must be a station on the list
  if (preferredMrt.value.trim() && !matchStation(preferredMrt.value)) {
    message.value = 'Please choose your preferred MRT station from the list.'
    document.getElementById('preferred-mrt')?.focus()
    return
  }
  preferredMrt.value = matchStation(preferredMrt.value) // tidy spelling, e.g. "bishan mrt" -> "Bishan"
  if (deliveryPostalCode.value && !/^\d{6}$/.test(deliveryPostalCode.value)) {
    message.value = 'Postal code must be 6 digits.'
    return
  }
  try {
    const response = await axios.put(`${API_URL}/users/${currentUser.value._id}`, {
      name: name.value,
      preferences: preferences.value,
      preferredMrt: preferredMrt.value,
      deliveryAddress: deliveryAddress.value,
      deliveryUnit: deliveryUnit.value,
      deliveryPostalCode: deliveryPostalCode.value,
    })
    saveUser(response.data) // keep the saved login + NavBar in sync
    fillForm(response.data)
    message.value = 'Profile saved!'
    editing.value = false
  } catch (error) {
    message.value = error.response?.data?.message || error.message
  }
}
</script>
 
<template>
  <div class="page-narrow">
      <h2 class="page-title">My profile</h2>
      <div v-if="message" class="alert alert-info">{{ message }}</div>
      <section class="card p-4 shadow-sm mb-4">
        <!-- profile picture (while editing: click it to upload / remove - same "Change Profile Photo" box as the seller's shop page) -->
        <div class="d-flex align-items-center gap-3 mb-4">
          <AvatarEditor :src="userAvatarUrl(currentUser)" :name="name || currentUser?.name" size="96px" :editable="editing"
            :upload-url="`${API_URL}/users/${currentUser._id}/avatar`" :remove-url="`${API_URL}/users/${currentUser._id}/avatar`"
            @uploaded="saveUser" @removed="saveUser" @error="photoError = $event" />
          <div class="flex-grow-1" style="min-width: 0">
            <h3 class="h5 mb-1 text-truncate">{{ name || currentUser?.name }}</h3>
            <p class="small text-muted mb-0">
              <template v-if="editing">Click your picture to {{ userAvatarUrl(currentUser) ? 'change or remove it' : 'add a profile photo' }}.</template>
              <template v-else>{{ email }}</template>
            </p>
            <p v-if="photoError" class="small text-danger mb-0">{{ photoError }}</p>
          </div>
          <button v-if="!editing" type="button" class="btn btn-primary edit-btn" @click="startEditing">
            <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
              <path d="M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708l-10 10a.5.5 0 0 1-.168.11l-5 2a.5.5 0 0 1-.65-.65l2-5a.5.5 0 0 1 .11-.168zM11.207 2.5 13.5 4.793 14.793 3.5 12.5 1.207zm1.586 3L10.5 3.207 4 9.707V10h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.293zm-9.761 5.175-.106.106-1.528 3.821 3.821-1.528.106-.106A.5.5 0 0 1 5 12.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.468-.325" />
            </svg>
            Edit profile
          </button>
        </div>

        <!-- view mode (the page opens like this) -->
        <dl v-if="!editing" class="profile-details mb-0">
          <div><dt>Name</dt><dd>{{ name || '-' }}</dd></div>
          <div><dt>Email</dt><dd>{{ email || '-' }}</dd></div>
          <div><dt>Preferred MRT station</dt><dd>{{ preferredMrt || 'Not set' }}</dd></div>
          <div><dt>Delivery address</dt><dd>{{ fullAddress || 'Not added' }}</dd></div>
          <div class="full">
            <dt>Interests</dt>
            <dd>
              <span v-for="category in preferences" :key="category" class="interest-chip">{{ category }}</span>
              <span v-if="preferences.length === 0" class="text-muted">None picked yet</span>
            </dd>
          </div>
        </dl>

        <!-- edit mode -->
        <template v-else>
        <div class="row g-3 mb-3">
          <div class="col-12 col-sm-6">
            <label class="form-label" for="buyer-name">Name</label>
            <input id="buyer-name" type="text" class="form-control" v-model.trim="name" maxlength="50"
              :class="{ 'is-valid': nameStatus === 'available', 'is-invalid': nameStatus === 'taken' }" />
            <p v-if="nameStatus" class="name-check" :class="nameStatus" aria-live="polite">
          <span v-if="nameStatus === 'checking'" class="spinner-border spinner-border-sm" aria-hidden="true"></span>
          <template v-else-if="nameStatus === 'available'"><svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0" /></svg></template>
          <template v-else><svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708" /></svg></template>
          {{ nameStatus === 'checking' ? 'Checking...' : nameMessage }}
        </p>
            <div v-if="!nameStatus" class="form-text">Must be different from every other user.</div>
          </div>
          <div class="col-12 col-sm-6">
            <label class="form-label" for="buyer-email">Email</label>
            <div class="locked-input">
              <input id="buyer-email" type="email" class="form-control" :value="email" disabled aria-describedby="email-locked" />
              <svg class="lock-icon" width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 1a2 2 0 0 1 2 2v4H6V3a2 2 0 0 1 2-2m3 6V3a3 3 0 0 0-6 0v4a2 2 0 0 0-2 2v5a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2" /></svg>
            </div>
            <div id="email-locked" class="form-text">Your email can't be changed.</div>
          </div>
        </div>

        <div class="mb-3">
          <label for="preferred-mrt" class="form-label">Preferred MRT station</label>
          <MrtSelect id="preferred-mrt" v-model="preferredMrt" placeholder="e.g. Bishan" />
          <!-- <div class="form-text">The map opens at this station when you switch from Browse.</div> -->
        </div>

        <fieldset class="mb-3">
          <legend class="form-label fs-6 mb-1">Delivery address <span class="text-muted small">(optional)</span></legend>
          <p class="form-text mt-0 mb-2">Filled in for you when you choose delivery. Sellers only see it on orders you send them.</p>
          <div class="row g-2">
            <div class="col-12">
              <label class="visually-hidden" for="delivery-address">Street address</label>
              <input id="delivery-address" v-model.trim="deliveryAddress" class="form-control" maxlength="200" placeholder="Block and street, e.g. 123 Bishan Street 12" autocomplete="street-address" />
            </div>
            <div class="col-6">
              <label class="visually-hidden" for="delivery-unit">Unit number</label>
              <input id="delivery-unit" v-model.trim="deliveryUnit" class="form-control" maxlength="30" placeholder="Unit, e.g. #05-123" />
            </div>
            <div class="col-6">
              <label class="visually-hidden" for="delivery-postal">Postal code</label>
              <input id="delivery-postal" v-model.trim="deliveryPostalCode" class="form-control" inputmode="numeric" maxlength="6" placeholder="Postal code" autocomplete="postal-code" />
            </div>
          </div>
        </fieldset>

        <div class="mb-3">
          <label class="form-label" for="buyer-interests">What are you interested in?</label>
          <CategoryMultiSelect id="buyer-interests" v-model="preferences" />
          <div class="form-text">Your For you feed shows more of these.</div>
        </div>

        <div class="d-flex gap-2">
          <button type="button" class="btn cancel-btn flex-fill" @click="cancelEditing">Cancel</button>
          <button type="button" class="btn btn-primary flex-fill" @click="save">Save profile</button>
        </div>
        </template>
      </section>

      <section class="card p-4 shadow-sm mb-4">
        <div class="d-flex justify-content-between align-items-end mb-2">
          <div><h3 class="h5 mb-1">Past purchases</h3><p class="small text-muted mb-0">Completed orders</p></div>
          <RouterLink to="/orders" class="small">View orders</RouterLink>
        </div>
        <PageSkeleton v-if="loadingActivity" variant="list" :count="2" compact label="Loading purchases" />
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
        <PageSkeleton v-if="loadingActivity" variant="list" :count="2" compact label="Loading followed shops" />
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
.edit-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  flex-shrink: 0;
  border-radius: 999px;
  padding: 0.5rem 1.2rem;
  font-weight: 600;
}
/* Cancel (edit mode): outlined, so it reads as a button */
.cancel-btn {
  border: 1.5px solid var(--line);
  background: var(--surface);
  color: var(--ink);
}
.cancel-btn:hover {
  border-color: var(--ocean);
  color: var(--ocean);
}
/* view mode: label above value, two columns on wide screens */
.profile-details {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1.1rem 2rem;
}
.profile-details .full {
  grid-column: 1 / -1;
}
.profile-details dt {
  margin-bottom: 0.2rem;
  font-size: 0.82rem;
  font-weight: 500;
  color: var(--muted);
}
.profile-details dd {
  margin: 0;
  overflow-wrap: anywhere;
  color: var(--ink);
}
.interest-chip {
  display: inline-block;
  margin: 0 0.4rem 0.4rem 0;
  padding: 0.3rem 0.85rem;
  border-radius: 999px;
  background: var(--ocean-soft);
  font-size: 0.85rem;
  color: var(--ocean-dark);
}
@media (max-width: 575.98px) {
  .profile-details {
    grid-template-columns: 1fr;
  }
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
  border: 1px solid var(--line);
  border-radius: 1rem;
  background: #fff;
  color: inherit;
  text-decoration: none;
  scroll-snap-align: start;
}
.purchase-card:hover, .followed-shop:hover { border-color: var(--brand); background: var(--surface-soft); }
.followed-list { display: grid; gap: 0.5rem; }
.followed-shop {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.75rem 1rem;
  border: 1px solid var(--line);
  border-radius: 0.8rem;
  color: inherit;
  text-decoration: none;
}
</style>
