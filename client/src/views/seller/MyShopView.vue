<template>
  <div class="container mt-4" v-if="shop">
    <div class="p-4 bg-light rounded mb-4">
      <h2>{{ shop.name }}</h2>
      <p><strong>Location (Nearest MRT):</strong> {{ shop.nearestMrt }}</p>
      <p><strong>Experience:</strong> {{ shop.experience }}</p>
      <div>
        <span class="badge bg-secondary me-1" v-for="cat in shop.categories" :key="cat">{{ cat }}</span>
      </div>
    </div>

    <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-1">
      <h4 class="mb-0">Products & Services</h4>
      <!-- select mode: tick products, then delete them together -->
      <div v-if="products.length > 0" class="d-flex align-items-center gap-2">
        <template v-if="selecting">
          <span class="small text-muted">{{ selectedIds.length }} selected</span>
          <button type="button" class="btn btn-sm btn-outline-secondary" @click="toggleSelectAll">
            {{ selectedIds.length === products.length ? 'Clear all' : 'Select all' }}
          </button>
          <button type="button" class="btn btn-sm btn-danger" :disabled="selectedIds.length === 0 || deleting" @click="deleteSelected">
            {{ deleting ? 'Deleting...' : 'Delete' }}
          </button>
          <button type="button" class="btn btn-sm btn-outline-secondary" :disabled="deleting" @click="stopSelecting">Cancel</button>
        </template>
        <button v-else type="button" class="btn btn-sm btn-outline-secondary" @click="selecting = true">Select</button>
      </div>
    </div>
    <p class="small text-muted mb-2">
      Pin up to {{ MAX_PINS }} products to show them first on your shop page ({{ pinnedIds.length }}/{{ MAX_PINS }} pinned)
    </p>
    <p v-if="actionError" class="text-danger small">{{ actionError }}</p>
    <p v-if="loadingProducts" class="text-muted">Loading products...</p>
    <p v-else-if="products.length === 0" class="text-muted">You have not listed any products yet.</p>
    <div class="row">
      <div class="col-sm-6 col-md-4 col-lg-3 mb-3" v-for="item in sortedProducts" :key="item._id">
        <div class="card h-100 shadow-sm"
          :class="{ 'border-warning': isPinned(item) && !selecting, 'border-primary selected': isSelected(item), 'selectable': selecting }"
          @click="selecting && toggleSelected(item)">
          <div class="position-relative">
            <!-- photo is loaded from its own URL (lazy), not sent inside the JSON -->
            <img :src="item.imageUrl || '/placeholder.svg'" class="card-img-top product-img" :alt="item.name"
              loading="lazy" decoding="async" @error="$event.target.src = '/placeholder.svg'">
            <input v-if="selecting" type="checkbox" class="form-check-input select-box" :checked="isSelected(item)"
              :aria-label="`Select ${item.name}`" @click.stop="toggleSelected(item)">
            <span v-if="isPinned(item)" class="badge bg-warning text-dark pinned-badge">Pinned</span>
          </div>
          <div class="card-body d-flex flex-column">
            <h6 class="card-title">{{ item.name }}</h6>
            <div>
              <span class="badge" :class="item.type === 'service' ? 'bg-info text-dark' : 'bg-success'">
                {{ (item.category || 'product').toUpperCase() }}
              </span>
            </div>
            <div class="d-flex justify-content-between align-items-center mt-auto pt-2">
              <span>{{ formatPrice(item.price) }} <span class="small text-muted">/ {{ item.unit }}</span></span>
              <div v-if="!selecting" class="d-flex gap-1">
                <button type="button" class="btn btn-sm btn-outline-primary icon-btn" data-label="Edit"
                  aria-label="Edit" @click="editModal.open(item)">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16" aria-hidden="true">
                    <path d="M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708l-10 10a.5.5 0 0 1-.168.11l-5 2a.5.5 0 0 1-.65-.65l2-5a.5.5 0 0 1 .11-.168zM11.207 2.5 13.5 4.793 14.793 3.5 12.5 1.207zm1.586 3L10.5 3.207 4 9.707V10h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.293zm-9.761 5.175-.106.106-1.528 3.821 3.821-1.528.106-.106A.5.5 0 0 1 5 12.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.468-.325"/>
                  </svg>
                </button>
                <button type="button" class="btn btn-sm icon-btn" :disabled="pinning"
                  :class="isPinned(item) ? 'btn-warning' : 'btn-outline-warning'"
                  :data-label="isPinned(item) ? 'Unpin' : 'Pin'" :aria-label="isPinned(item) ? 'Unpin' : 'Pin'"
                  @click="togglePin(item)">
                  <svg v-if="isPinned(item)" xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16" aria-hidden="true">
                    <path d="M9.828.722a.5.5 0 0 1 .354.146l4.95 4.95a.5.5 0 0 1 0 .707c-.48.48-1.072.588-1.503.588-.177 0-.335-.018-.46-.039l-3.134 3.134a6 6 0 0 1 .16 1.013c.046.702-.032 1.687-.72 2.375a.5.5 0 0 1-.707 0l-2.829-2.828-3.182 3.182c-.195.195-1.219.902-1.414.707s.512-1.22.707-1.414l3.182-3.182-2.828-2.829a.5.5 0 0 1 0-.707c.688-.688 1.673-.767 2.375-.72a6 6 0 0 1 1.013.16l3.134-3.133a3 3 0 0 1-.04-.461c0-.43.108-1.022.589-1.503a.5.5 0 0 1 .353-.146"/>
                  </svg>
                  <svg v-else xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16" aria-hidden="true">
                    <path d="M9.828.722a.5.5 0 0 1 .354.146l4.95 4.95a.5.5 0 0 1 0 .707c-.48.48-1.072.588-1.503.588-.177 0-.335-.018-.46-.039l-3.134 3.134a6 6 0 0 1 .16 1.013c.046.702-.032 1.687-.72 2.375a.5.5 0 0 1-.707 0l-2.829-2.828-3.182 3.182c-.195.195-1.219.902-1.414.707s.512-1.22.707-1.414l3.182-3.182-2.828-2.829a.5.5 0 0 1 0-.707c.688-.688 1.673-.767 2.375-.72a6 6 0 0 1 1.013.16l3.134-3.133a3 3 0 0 1-.04-.461c0-.43.108-1.022.589-1.503a.5.5 0 0 1 .353-.146m.122 2.112v-.002zm0-.002v.002a.5.5 0 0 1-.122.51L6.293 6.878a.5.5 0 0 1-.511.12H5.78l-.014-.004a5 5 0 0 0-.288-.076 5 5 0 0 0-.765-.116c-.422-.028-.836.008-1.175.15l5.51 5.509c.141-.34.177-.753.149-1.175a5 5 0 0 0-.192-1.054l-.004-.013v-.001a.5.5 0 0 1 .12-.512l3.536-3.535a.5.5 0 0 1 .532-.115l.096.022c.087.017.208.034.344.034q.172.002.343-.04L9.927 2.028q-.042.172-.04.343a1.8 1.8 0 0 0 .062.46z"/>
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <EditProductModal ref="editModal" @saved="loadProducts" />
  </div>

  <!-- no shop yet: send the seller to set up their profile first -->
  <div v-else-if="!loadingProducts" class="container mt-4">
    <div class="card p-4 shadow-sm text-center">
      <h5>You don't have a shop yet</h5>
      <p class="text-muted mb-3">Set up your shop profile first. After that you can add products and services.</p>
      <div><RouterLink to="/profile" class="btn btn-brand">Set up my shop profile</RouterLink></div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import axios from 'axios'
import { currentUser } from '@/utils/auth'
import { API_URL } from '@/utils/config'
import { formatPrice } from '@/utils/format'
import EditProductModal from '@/components/EditProductModal.vue'

const shop = ref(null)
const products = ref([])
const loadingProducts = ref(true)
const actionError = ref('')

// edit a listing in a pop-up (onclick of Edit icon); after saving, reload the list from the database
const editModal = ref(null)

// pinned products (shown first on the shop page)
const MAX_PINS = 3
const pinnedIds = ref([])
const pinning = ref(false)
const isPinned = (item) => pinnedIds.value.includes(item._id)
// pinned first (in the order they were pinned), the rest stay newest first
const pinRank = (item) => (isPinned(item) ? pinnedIds.value.indexOf(item._id) : MAX_PINS)
const sortedProducts = computed(() => [...products.value].sort((a, b) => pinRank(a) - pinRank(b)))

async function togglePin(item) {
  actionError.value = ''
  pinning.value = true
  try {
    const res = await axios.put(`${API_URL}/shops/${shop.value._id}/pin`, { user: currentUser.value._id, productId: item._id })
    pinnedIds.value = res.data.pinnedProducts.map(String)
  } catch (err) {
    actionError.value = err.response?.data?.message || err.message
  } finally {
    pinning.value = false
  }
}

// select mode -> delete several products at once
const selecting = ref(false)
const selectedIds = ref([])
const deleting = ref(false)
const isSelected = (item) => selectedIds.value.includes(item._id)
function toggleSelected(item) {
  selectedIds.value = isSelected(item) ? selectedIds.value.filter((id) => id !== item._id) : [...selectedIds.value, item._id]
}
function toggleSelectAll() {
  selectedIds.value = selectedIds.value.length === products.value.length ? [] : products.value.map((p) => p._id)
}
function stopSelecting() {
  selecting.value = false
  selectedIds.value = []
}

async function deleteSelected() {
  const count = selectedIds.value.length
  if (!window.confirm(`Delete ${count} product${count === 1 ? '' : 's'}? This cannot be undone.`)) return
  actionError.value = ''
  deleting.value = true
  const results = await Promise.allSettled(
    selectedIds.value.map((id) => axios.delete(`${API_URL}/products/${id}`, { data: { user: currentUser.value._id } }))
  )
  const failed = results.filter((r) => r.status === 'rejected').length
  if (failed > 0) actionError.value = `${failed} product${failed === 1 ? '' : 's'} could not be deleted. Please try again.`
  deleting.value = false
  stopSelecting()
  await loadShop() // pins may have changed too
}

// always read from the database, so the list matches what was saved
async function loadProducts() {
  try {
    const res = await axios.get(`${API_URL}/products/shop/${shop.value._id}`)
    products.value = res.data
  } catch (error) {
    actionError.value = 'Could not load your products. Please refresh the page.'
    console.error('Error loading products', error)
  }
}

async function loadShop() {
  if (!currentUser.value?._id) {
    loadingProducts.value = false
    return
  }
  try {
    // 1. Fetch the logged-in user's shop using their ID
    const res = await axios.get(`${API_URL}/shops/mine/${currentUser.value._id}`)
    if (res.data) {
      shop.value = res.data
      pinnedIds.value = (res.data.pinnedProducts || []).map(String)
      // 2. Fetch products belonging to this shop
      await loadProducts()
    }
  } catch (error) {
    console.error("Error loading shop data", error)
  } finally {
    loadingProducts.value = false
  }
}

// load on open, and again if the user logs in as someone else
watch(() => currentUser.value?._id, loadShop, { immediate: true })
</script>

<style scoped>
.icon-btn {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
}
/* small label above the icon on hover, e.g. "Edit" / "Pin" */
.icon-btn[data-label]:hover::after,
.icon-btn[data-label]:focus-visible::after {
  content: attr(data-label);
  position: absolute;
  bottom: calc(100% + 6px);
  left: 50%;
  transform: translateX(-50%);
  padding: 2px 8px;
  border-radius: 4px;
  background: #212529;
  color: #fff;
  font-size: 0.75rem;
  white-space: nowrap;
  pointer-events: none;
  z-index: 10;
}
.pinned-badge {
  position: absolute;
  top: 8px;
  right: 8px;
}
.select-box {
  position: absolute;
  top: 8px;
  left: 8px;
  width: 1.4rem;
  height: 1.4rem;
  margin: 0;
  cursor: pointer;
}
.selectable {
  cursor: pointer;
}
.selected {
  box-shadow: 0 0 0 2px var(--bs-primary) !important;
}
</style>
