<template>
  <div v-if="shop">
    <!-- channel-style header (same as the public shop page); click the circle to change the profile picture -->
    <ShopHeader :shop="shop" :product-count="products.length" is-owner>
      <template #actions>
        <RouterLink to="/profile" class="btn btn-primary owner-btn">Edit profile</RouterLink>
      </template>
    </ShopHeader>
    <div class="shop-details mb-4">
      <span v-if="shop.nearestMrt"><strong>Nearest MRT:</strong> {{ shop.nearestMrt }}</span>
      <span v-if="shop.experience"><strong>Experience:</strong> {{ shop.experience }}</span>
      <span v-if="shop.categories?.length">
        <span class="badge bg-secondary me-1" v-for="cat in shop.categories" :key="cat">{{ cat }}</span>
      </span>
    </div>

    <!-- how buyers can get their orders: saved as soon as a switch is flipped -->
    <section class="fulfil-box mb-4" aria-labelledby="fulfil-title">
      <div>
        <h6 id="fulfil-title" class="mb-0">Order options</h6>
        <span class="small text-muted">Choose how buyers can get their orders. Keep at least one on.</span>
      </div>
      <div class="d-flex flex-wrap align-items-center gap-4">
        <div v-for="option in FULFIL_OPTIONS" :key="option.key" class="form-check form-switch mb-0">
          <input :id="`fulfil-${option.key}`" type="checkbox" role="switch" class="form-check-input"
            :checked="shop[option.key] !== false" :disabled="savingFulfil" @change="toggleFulfil(option.key, $event)">
          <label class="form-check-label" :for="`fulfil-${option.key}`">{{ option.label }}</label>
        </div>
        <span v-if="savingFulfil" class="small text-muted">Saving...</span>
        <span v-else-if="fulfilMessage" class="small" :class="fulfilError ? 'text-danger' : 'text-success'" role="status">{{ fulfilMessage }}</span>
      </div>
    </section>

    <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-1">
      <h4 class="mb-0">Products & services</h4>
      <!-- select mode: tick products, then delete them together -->
      <div class="d-flex align-items-center gap-2">
        <template v-if="selecting && products.length > 0">
          <span class="small text-muted">{{ selectedIds.length }} selected</span>
          <button type="button" class="btn btn-sm btn-outline-secondary" @click="toggleSelectAll">
            {{ shownProducts.length && shownProducts.every((p) => selectedIds.includes(p._id)) ? 'Clear all' : 'Select all' }}
          </button>
          <button type="button" class="btn btn-sm btn-danger" :disabled="selectedIds.length === 0 || deleting" @click="deleteSelected">
            {{ deleting ? 'Deleting...' : 'Delete' }}
          </button>
          <button type="button" class="btn btn-sm btn-outline-secondary" :disabled="deleting" @click="stopSelecting">Cancel</button>
        </template>
        <template v-else>
          <button v-if="products.length > 0" type="button" class="btn btn-sm btn-outline-secondary" @click="selecting = true">Select</button>
          <RouterLink to="/seller/products" class="btn btn-sm btn-brand">+ Add product</RouterLink>
        </template>
      </div>
    </div>
    <p class="small text-muted mb-2">
      Pin up to {{ MAX_PINS }} products to show them first on your shop page ({{ pinnedIds.length }}/{{ MAX_PINS }} pinned)
    </p>
    <p v-if="actionError" class="text-danger small">{{ actionError }}</p>
    <p v-if="loadingProducts" class="text-muted">Loading products...</p>
    <p v-else-if="products.length === 0" class="text-muted">You have not listed any products yet.</p>
    <template v-else>
      <SearchBox v-model="productSearch" class="mb-3" placeholder="Search your products & services by name, category or tag"
        label="Search my products and services" />
      <p v-if="shownProducts.length === 0" class="text-muted">No products match "{{ productSearch }}".</p>
    </template>
    <div class="card-grid">
      <div v-for="item in shownProducts" :key="item._id">
        <div class="card product-tile h-100 shadow-sm"
          :class="{ 'border-warning': isPinned(item) && !selecting, 'border-primary selected': isSelected(item), 'selectable': selecting }"
          @click="selecting && toggleSelected(item)">
          <div class="position-relative">
            <!-- photo is loaded from its own URL (lazy), not sent inside the JSON -->
            <img :src="item.imageUrl || '/placeholder.svg'" class="card-img-top product-img" :alt="item.name"
              loading="lazy" decoding="async" @error="$event.target.src = '/placeholder.svg'">
            <!-- select mode: a checkbox on every card, ticked when the card is selected -->
            <label v-if="selecting" class="select-box" @click.stop>
              <input type="checkbox" class="form-check-input" :checked="isSelected(item)"
                :aria-label="`Select ${item.name}`" @change="toggleSelected(item)">
            </label>
          </div>
          <!-- pin / unpin: the button in the top right corner of every card (filled amber = pinned) -->
          <button type="button" class="feature-toggle" :class="{ pinned: isPinned(item) }"
              :disabled="pinning || selecting" :data-label="isPinned(item) ? 'Unpin' : 'Pin'"
              :aria-label="isPinned(item) ? `Unpin ${item.name}` : `Pin ${item.name}`" :aria-pressed="isPinned(item)"
              @click.stop="togglePin(item)">
              <svg v-if="isPinned(item)" xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16" aria-hidden="true">
                <path d="M9.828.722a.5.5 0 0 1 .354.146l4.95 4.95a.5.5 0 0 1 0 .707c-.48.48-1.072.588-1.503.588-.177 0-.335-.018-.46-.039l-3.134 3.134a6 6 0 0 1 .16 1.013c.046.702-.032 1.687-.72 2.375a.5.5 0 0 1-.707 0l-2.829-2.828-3.182 3.182c-.195.195-1.219.902-1.414.707s.512-1.22.707-1.414l3.182-3.182-2.828-2.829a.5.5 0 0 1 0-.707c.688-.688 1.673-.767 2.375-.72a6 6 0 0 1 1.013.16l3.134-3.133a3 3 0 0 1-.04-.461c0-.43.108-1.022.589-1.503a.5.5 0 0 1 .353-.146"/>
              </svg>
              <svg v-else xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16" aria-hidden="true">
                <path d="M9.828.722a.5.5 0 0 1 .354.146l4.95 4.95a.5.5 0 0 1 0 .707c-.48.48-1.072.588-1.503.588-.177 0-.335-.018-.46-.039l-3.134 3.134a6 6 0 0 1 .16 1.013c.046.702-.032 1.687-.72 2.375a.5.5 0 0 1-.707 0l-2.829-2.828-3.182 3.182c-.195.195-1.219.902-1.414.707s.512-1.22.707-1.414l3.182-3.182-2.828-2.829a.5.5 0 0 1 0-.707c.688-.688 1.673-.767 2.375-.72a6 6 0 0 1 1.013.16l3.134-3.133a3 3 0 0 1-.04-.461c0-.43.108-1.022.589-1.503a.5.5 0 0 1 .353-.146m.122 2.112v-.002zm0-.002v.002a.5.5 0 0 1-.122.51L6.293 6.878a.5.5 0 0 1-.511.12H5.78l-.014-.004a5 5 0 0 0-.288-.076 5 5 0 0 0-.765-.116c-.422-.028-.836.008-1.175.15l5.51 5.509c.141-.34.177-.753.149-1.175a5 5 0 0 0-.192-1.054l-.004-.013v-.001a.5.5 0 0 1 .12-.512l3.536-3.535a.5.5 0 0 1 .532-.115l.096.022c.087.017.208.034.344.034q.172.002.343-.04L9.927 2.028q-.042.172-.04.343a1.8 1.8 0 0 0 .062.46z"/>
              </svg>
          </button>
          <div class="card-body d-flex flex-column">
            <h6 class="card-title clamp-2">{{ item.name }}</h6>
            <div>
              <span class="badge" :class="item.type === 'service' ? 'bg-info text-dark' : 'bg-success'">
                {{ capitalize(item.category || 'Others') }}
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
              </div>
            </div>
            <!-- a button (not an href="#product-reviews" link): some ad blockers hide links like that -->
            <button v-if="!selecting" type="button" class="btn btn-sm btn-outline-secondary mt-3"
              :aria-label="`View reviews for ${item.name}`" @click="showReviewsFor(item)">View reviews</button>
          </div>
        </div>
      </div>
    </div>

    <section id="product-reviews" class="card p-4 mt-4 mb-4" aria-labelledby="product-reviews-title">
      <h4 id="product-reviews-title">Product reviews</h4>
      <p class="text-muted">See what buyers say about your products and services.</p>
      <div class="mb-3">
        <label for="review-product" class="form-label">Filter by product</label>
        <select id="review-product" v-model="selectedReviewProduct" class="form-select">
          <option value="">All products</option>
          <option v-for="item in products" :key="item._id" :value="item._id">{{ item.name }}</option>
        </select>
      </div>
      <ReviewList :key="shop._id" :shop-id="shop._id" :product-id="selectedReviewProduct" />
    </section>

    <EditProductModal ref="editModal" @saved="loadProducts" />
  </div>

  <!-- no shop yet: send the seller to set up their profile first -->
  <div v-else-if="!loadingProducts">
    <div class="card p-4 shadow-sm text-center">
      <h5>You don't have a shop yet</h5>
      <p class="text-muted mb-3">Set up your shop profile first. After that you can add products and services.</p>
      <div><RouterLink to="/profile" class="btn btn-brand">Set up my shop profile</RouterLink></div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import axios from 'axios'
import { currentUser } from '@/utils/auth'
import { API_URL } from '@/utils/config'
import { formatPrice, capitalize } from '@/utils/format'
import EditProductModal from '@/components/EditProductModal.vue'
import ReviewList from '@/components/ReviewList.vue'
import SearchBox from '@/components/SearchBox.vue'
import ShopHeader from '@/components/ShopHeader.vue'

const router = useRouter()
const route = useRoute()
const shop = ref(null)
const products = ref([])
const loadingProducts = ref(true)
const actionError = ref('')
const selectedReviewProduct = ref('')
let shopController

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

// search my own listings (name, category, tags, description) - handy once the list gets long
const productSearch = ref('')
const shownProducts = computed(() => {
  const q = productSearch.value.trim().toLowerCase()
  if (!q) return sortedProducts.value
  return sortedProducts.value.filter((p) =>
    [p.name, p.category, p.description, ...(p.tags || [])].some((text) => (text || '').toLowerCase().includes(q)))
})

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
  // "Select all" = all products shown (so it respects the search)
  const ids = shownProducts.value.map((p) => p._id)
  selectedIds.value = ids.every((id) => selectedIds.value.includes(id)) ? [] : ids
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
  const shopId = shop.value?._id
  const userId = currentUser.value?._id
  if (!shopId) return
  try {
    const res = await axios.get(`${API_URL}/products/shop/${shopId}`)
    if (shop.value?._id !== shopId || currentUser.value?._id !== userId) return
    products.value = res.data
    if (!products.value.some((product) => product._id === selectedReviewProduct.value)) selectedReviewProduct.value = ''
  } catch (error) {
    if (shop.value?._id !== shopId || currentUser.value?._id !== userId) return
    actionError.value = 'Could not load your products. Please refresh the page.'
    console.error('Error loading products', error)
  }
}

async function loadShop() {
  shopController?.abort()
  shop.value = null
  products.value = []
  pinnedIds.value = []
  selectedReviewProduct.value = ''
  stopSelecting()
  actionError.value = ''
  const user = currentUser.value
  if (!user || user.role !== 'seller') {
    loadingProducts.value = false
    router.replace(user ? '/home' : '/login')
    return
  }
  const request = new AbortController()
  shopController = request
  loadingProducts.value = true
  try {
    // 1. Fetch the logged-in user's shop using their ID
    const res = await axios.get(`${API_URL}/shops/mine/${user._id}`, { signal: request.signal })
    if (request.signal.aborted) return
    if (res.data) {
      shop.value = res.data
      pinnedIds.value = (res.data.pinnedProducts || []).map(String)
      // 2. Fetch products belonging to this shop
      await loadProducts()
    }
  } catch (error) {
    if (!request.signal.aborted) console.error("Error loading shop data", error)
  } finally {
    if (shopController === request) loadingProducts.value = false
  }
}

// ---- order options: pickup / delivery (Shop.pickup, Shop.delivery) ----
const FULFIL_OPTIONS = [{ key: 'pickup', label: 'Pickup' }, { key: 'delivery', label: 'Delivery' }]
const savingFulfil = ref(false)
const fulfilMessage = ref('')
const fulfilError = ref(false)
async function toggleFulfil(key, event) {
  const changes = { pickup: shop.value.pickup !== false, delivery: shop.value.delivery === true, [key]: event.target.checked }
  fulfilError.value = false
  if (!changes.pickup && !changes.delivery) { // buyers need at least one way to get their order
    event.target.checked = true
    fulfilError.value = true
    fulfilMessage.value = 'Keep at least one option on.'
    return
  }
  savingFulfil.value = true
  try {
    const res = await axios.put(`${API_URL}/shops/${shop.value._id}`, changes)
    shop.value.pickup = res.data.pickup
    shop.value.delivery = res.data.delivery
    fulfilMessage.value = 'Saved.'
  } catch (err) {
    event.target.checked = !event.target.checked // put the switch back
    fulfilError.value = true
    fulfilMessage.value = err.response?.data?.message || 'Could not save. Please try again.'
  } finally {
    savingFulfil.value = false
  }
}

// load on open, and again if the user logs in as someone else
// "View reviews" on a card: filter the reviews to that product and scroll down to them
function showReviewsFor(item) {
  selectedReviewProduct.value = item._id
  document.getElementById('product-reviews')?.scrollIntoView({ behavior: 'smooth' })
}

// /seller/shop?review=<productId>#product-reviews (from a "new review" notification):
// filter the reviews to that product and scroll down to them
async function showRequestedReviews() {
  const productId = route.query.review
  if (!productId || !products.value.some((p) => p._id === productId)) return
  selectedReviewProduct.value = productId
  router.replace({ query: {}, hash: '#product-reviews' }) // only do this once, not after every reload
  await nextTick()
  document.getElementById('product-reviews')?.scrollIntoView({ behavior: 'smooth' })
}
watch(() => route.query.review, showRequestedReviews) // clicked while already on this page
watch(products, showRequestedReviews) // clicked from another page: wait for the products to load

watch(() => [currentUser.value?._id, currentUser.value?.role], loadShop, { immediate: true })
onBeforeUnmount(() => shopController?.abort())
</script>

<style scoped>
.fulfil-box {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.75rem 1.5rem;
  padding: 0.9rem 1.1rem;
  border: 1px solid var(--line);
  border-radius: 0.75rem;
  background: var(--surface-soft);
}
/* MRT, experience and categories under the header */
.shop-details {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem 1.5rem;
  padding: 0 0.25rem 1.25rem;
  border-bottom: 1px solid var(--line);
  color: var(--ink-soft);
}
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
  background: var(--navy);
  color: #fff;
  font-size: 0.75rem;
  white-space: nowrap;
  pointer-events: none;
  z-index: 10;
}
/* pin button in the top right corner of the card: white outline pin = not pinned, amber filled pin = pinned
   (pinned looks the same as on the public shop page).
   NOTE: don't call this class "pin-..." - ad blockers hide those (they look like Pinterest "Pin it" buttons) */
.feature-toggle {
  position: absolute; /* .card is position: relative */
  top: 10px;
  right: 10px;
  z-index: 5; /* above the photo and everything else on the card */
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.92);
  color: var(--ink-soft);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
  transition: background 0.15s ease, color 0.15s ease, transform 0.15s ease;
}
.feature-toggle:hover:not(:disabled) {
  color: var(--navy);
  transform: scale(1.08);
}
.feature-toggle.pinned {
  background: var(--amber);
  color: var(--navy);
}
.feature-toggle:disabled {
  opacity: 1;
  cursor: default;
}
/* "Pin" / "Unpin" label under the button on hover */
.feature-toggle[data-label]:hover:not(:disabled)::after,
.feature-toggle[data-label]:focus-visible::after {
  content: attr(data-label);
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  padding: 2px 8px;
  border-radius: 4px;
  background: var(--navy);
  color: #fff;
  font-size: 0.75rem;
  white-space: nowrap;
  pointer-events: none;
  z-index: 10;
}
/* white pad behind the checkbox so it shows up on any photo */
.select-box {
  position: absolute;
  top: 8px;
  left: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  margin: 0;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.92);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
  cursor: pointer;
}
.select-box .form-check-input {
  width: 1.3rem;
  height: 1.3rem;
  margin: 0;
  border: 2px solid var(--muted);
  cursor: pointer;
}
.select-box .form-check-input:checked {
  border-color: var(--ocean);
}
/* product cards: no background until hovered (like YouTube), same as ProductCard */
.product-tile {
  --bs-card-bg: transparent;
  transition: background-color 0.18s ease;
}
.product-tile:hover,
.product-tile.selected {
  --bs-card-bg: var(--tile);
}
.selectable {
  cursor: pointer;
}
.selected {
  box-shadow: 0 0 0 2px var(--bs-primary) !important;
}
</style>
