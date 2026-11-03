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

    <div class="settings-row mb-4">
    <!-- how buyers can get their orders: saved as soon as a switch is flipped -->
    <section class="settings-card" aria-labelledby="fulfil-title">
      <div class="settings-head">
        <div>
          <h6 id="fulfil-title" class="settings-title">Order options</h6>
          <p class="settings-sub">Keep at least one on.</p>
        </div>
        <span v-if="savingFulfil" class="save-pill" role="status">Saving...</span>
        <span v-else-if="fulfilMessage" class="save-pill" :class="{ error: fulfilError }" role="status">
          <svg v-if="!fulfilError" width="12" height="12" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M12.736 3.97a.733.733 0 0 1 1.047 0c.286.289.29.756.01 1.05L7.88 12.01a.733.733 0 0 1-1.065.02L3.217 8.384a.757.757 0 0 1 0-1.06.733.733 0 0 1 1.047 0l3.052 3.093 5.4-6.425z" /></svg>
          {{ fulfilError ? fulfilMessage : 'Saved' }}
        </span>
      </div>
      <div class="option-list">
        <label v-for="option in FULFIL_OPTIONS" :key="option.key" class="option-row" :for="`fulfil-${option.key}`">
          <span class="option-icon" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor"><path :d="option.icon" /></svg>
          </span>
          <span class="option-text">
            <strong>{{ option.label }}</strong>
            <small>{{ option.hint }}</small>
          </span>
          <span class="form-check form-switch m-0">
            <input :id="`fulfil-${option.key}`" type="checkbox" role="switch" class="form-check-input"
              :checked="shop[option.key] !== false" :disabled="savingFulfil" @change="toggleFulfil(option.key, $event)">
          </span>
        </label>
      </div>
    </section>

    <!-- one order slot added to every product at once -->
    <section class="settings-card" aria-labelledby="bulk-slot-title">
      <div class="settings-head">
        <div>
          <h6 id="bulk-slot-title" class="settings-title">Order slots for all products</h6>
          <p class="settings-sub">Adds the same time to every product in your shop.</p>
        </div>
        <button type="button" class="btn view-slots-btn" data-bs-toggle="modal" data-bs-target="#all-slots-modal">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M5 11.5a.5.5 0 0 1 .5-.5h9a.5.5 0 0 1 0 1h-9a.5.5 0 0 1-.5-.5m0-4a.5.5 0 0 1 .5-.5h9a.5.5 0 0 1 0 1h-9a.5.5 0 0 1-.5-.5m0-4a.5.5 0 0 1 .5-.5h9a.5.5 0 0 1 0 1h-9a.5.5 0 0 1-.5-.5m-3 1a1 1 0 1 0 0-2 1 1 0 0 0 0 2m0 4a1 1 0 1 0 0-2 1 1 0 0 0 0 2m0 4a1 1 0 1 0 0-2 1 1 0 0 0 0 2" /></svg>
          View all slots ({{ upcomingSlots.length }})
        </button>
      </div>
      <form class="bulk-slot-form" @submit.prevent="addSlotToAll">
        <div>
          <label class="form-label small mb-1" for="bulk-slot-date">Date</label>
          <input id="bulk-slot-date" v-model="bulkSlot.date" type="date" class="form-control" :min="todayInput" required />
        </div>
        <div>
          <label class="form-label small mb-1" for="bulk-slot-time">Time</label>
          <input id="bulk-slot-time" v-model="bulkSlot.time" type="time" class="form-control" required />
        </div>
        <div>
          <label class="form-label small mb-1" for="bulk-slot-cap">Max orders</label>
          <input id="bulk-slot-cap" v-model.number="bulkSlot.capacity" type="number" min="1" max="999" class="form-control" required />
        </div>
        <button type="submit" class="btn btn-brand add-all-btn" :disabled="addingSlot || !products.length">
          {{ addingSlot ? 'Adding...' : '+ Add to all' }}
        </button>
      </form>
      <p v-if="bulkSlotMessage" class="small mb-0" :class="bulkSlotError ? 'text-danger' : 'text-success'" role="status">{{ bulkSlotMessage }}</p>
      <!-- repeating slots: drag on a weekly timetable, repeat weekly / monthly / every N weeks -->
      <div class="settings-foot">
        <button type="button" class="btn btn-link p-0 recurring-link" :disabled="!products.length" @click="recurring?.open()">
          <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M1 11.5a.5.5 0 0 0 .5.5h11.793l-3.147 3.146a.5.5 0 0 0 .708.708l4-4a.5.5 0 0 0 0-.708l-4-4a.5.5 0 0 0-.708.708L13.293 11H1.5a.5.5 0 0 0-.5.5m14-7a.5.5 0 0 1-.5.5H2.707l3.147 3.146a.5.5 0 1 1-.708.708l-4-4a.5.5 0 0 1 0-.708l4-4a.5.5 0 1 1 .708.708L2.707 4H14.5a.5.5 0 0 1 .5.5" /></svg>
          Set up recurring slots (weekly, monthly or custom)
        </button>
      </div>
    </section>
    </div>

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
    <PageSkeleton v-if="loadingProducts" variant="grid" :count="4" label="Loading products" />
    <p v-else-if="products.length === 0" class="text-muted">You have not listed any products yet.</p>
    <template v-else>
      <SearchBox v-model="productSearch" class="mb-3" placeholder="Search your products & services by name, category or tag"
        label="Search my products and services" />
      <p v-if="shownProducts.length === 0" class="text-muted">No products match "{{ productSearch }}".</p>
    </template>
    <div class="card-grid">
      <div v-for="item in shownProducts" :key="item._id">
        <div class="card product-tile h-100 shadow-sm"
          :class="{ 'border-warning': isPinned(item) && !selecting, 'border-primary selected': isSelected(item), 'selectable': selecting, paused: item.isAvailable === false }"
          @click="selecting && toggleSelected(item)">
          <div class="position-relative">
            <!-- photo is loaded from its own URL (lazy), not sent inside the JSON -->
            <img :src="item.imageUrl || '/placeholder.svg'" class="card-img-top product-img" :alt="item.name"
              loading="lazy" decoding="async" @error="$event.target.src = '/placeholder.svg'">
            <span v-if="item.isAvailable === false" class="paused-badge">Orders closed</span>
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
                <!-- close orders = stop taking orders but keep the product; reopen = take orders again -->
                <button type="button" class="btn btn-sm icon-btn" :class="item.isAvailable === false ? 'btn-success' : 'btn-outline-secondary'"
                  :data-label="item.isAvailable === false ? 'Reopen orders' : 'Close orders'"
                  :aria-label="item.isAvailable === false ? `Reopen orders for ${item.name}` : `Close orders for ${item.name}`"
                  :aria-pressed="item.isAvailable === false" :disabled="pausingId === item._id" @click="togglePause(item)">
                  <svg v-if="item.isAvailable === false" width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M10.854 8.146a.5.5 0 0 1 0 .708l-3 3a.5.5 0 0 1-.708 0l-1.5-1.5a.5.5 0 0 1 .708-.708L7.5 10.793l2.646-2.647a.5.5 0 0 1 .708 0M8 1a2.5 2.5 0 0 1 2.5 2.5V4h-5v-.5A2.5 2.5 0 0 1 8 1m3.5 3v-.5a3.5 3.5 0 1 0-7 0V4H1v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V4zM2 5h12v9a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1z" /></svg>
                  <svg v-else width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M6.146 8.146a.5.5 0 0 1 .708 0L8 9.293l1.146-1.147a.5.5 0 1 1 .708.708L8.707 10l1.147 1.146a.5.5 0 0 1-.708.708L8 10.707l-1.146 1.147a.5.5 0 0 1-.708-.708L7.293 10 6.146 8.854a.5.5 0 0 1 0-.708M8 1a2.5 2.5 0 0 1 2.5 2.5V4h-5v-.5A2.5 2.5 0 0 1 8 1m3.5 3v-.5a3.5 3.5 0 1 0-7 0V4H1v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V4zM2 5h12v9a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1z" /></svg>
                </button>
                <button type="button" class="btn btn-sm btn-outline-primary icon-btn" data-label="Edit"
                  aria-label="Edit" @click="editModal.open(item)">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16" aria-hidden="true">
                    <path d="M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708l-10 10a.5.5 0 0 1-.168.11l-5 2a.5.5 0 0 1-.65-.65l2-5a.5.5 0 0 1 .11-.168zM11.207 2.5 13.5 4.793 14.793 3.5 12.5 1.207zm1.586 3L10.5 3.207 4 9.707V10h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.293zm-9.761 5.175-.106.106-1.528 3.821 3.821-1.528.106-.106A.5.5 0 0 1 5 12.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.468-.325"/>
                  </svg>
                </button>
              </div>
            </div>
            <p v-if="item.isAvailable === false" class="paused-note">Buyers can still see it but can't order. Reopen orders any time.</p>
            <p v-if="pauseError[item._id]" class="small text-danger mb-0 mt-1" role="alert">{{ pauseError[item._id] }}</p>
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
    <RecurringSlotsModal v-if="shop" ref="recurring" :shop-id="shop._id" :products="products" @saved="loadProducts" />

    <!-- every order slot of every product, grouped by time (Teleport: a modal must sit directly in <body>) -->
    <Teleport to="body">
      <div id="all-slots-modal" class="modal fade" tabindex="-1" aria-labelledby="all-slots-title" aria-hidden="true">
        <div class="modal-dialog modal-dialog-scrollable modal-lg">
          <div class="modal-content">
            <div class="modal-header">
              <h5 id="all-slots-title" class="modal-title">All order slots</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body">
              <div class="btn-group btn-group-sm mb-3" role="group" aria-label="Which slots">
                <button type="button" class="btn" :class="slotView === 'upcoming' ? 'btn-brand' : 'btn-outline-secondary'"
                  :aria-pressed="slotView === 'upcoming'" @click="slotView = 'upcoming'">Upcoming ({{ upcomingSlots.length }})</button>
                <button type="button" class="btn" :class="slotView === 'past' ? 'btn-brand' : 'btn-outline-secondary'"
                  :aria-pressed="slotView === 'past'" @click="slotView = 'past'">Past ({{ pastSlots.length }})</button>
              </div>
              <p v-if="shownSlots.length === 0" class="text-muted mb-0">
                {{ slotView === 'upcoming' ? 'No upcoming slots. Add one with "+ Add to all", or per product when you edit it.' : 'No past slots.' }}
              </p>
              <ul v-else class="slot-list">
                <li v-for="group in shownSlots" :key="group.time" class="slot-row">
                  <div class="slot-when">
                    <strong>{{ formatDateTime(group.time) }}</strong>
                    <span class="small text-muted">{{ isAllProducts(group) ? `${products.length} products` : `${group.items.length} of ${products.length} products` }}</span>
                  </div>
                  <div class="slot-products">
                    <!-- every product has this time: one chip instead of listing them all -->
                    <span v-if="isAllProducts(group)" class="slot-chip all">
                      All products <span class="text-muted">&middot; max {{ capacityText(group) }} each</span>
                    </span>
                    <template v-else>
                      <span v-for="item in group.items" :key="item.id" class="slot-chip">
                        {{ item.name }} <span class="text-muted">&middot; max {{ item.capacity }}</span>
                      </span>
                    </template>
                  </div>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>

  <!-- still loading the shop: show its layout in grey -->
  <PageSkeleton v-else-if="loadingProducts" variant="shop" label="Loading your shop" />

  <!-- no shop yet: send the seller to set up their profile first -->
  <div v-else>
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
import { formatPrice, capitalize, formatDateTime } from '@/utils/format'
import EditProductModal from '@/components/EditProductModal.vue'
import RecurringSlotsModal from '@/components/RecurringSlotsModal.vue'
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
const FULFIL_OPTIONS = [
  { key: 'pickup', label: 'Pickup', hint: 'Buyers collect from you',
    icon: 'M2.97 1.35A1 1 0 0 1 3.73 1h8.54a1 1 0 0 1 .76.35l2.609 3.044A1.5 1.5 0 0 1 16 5.37v.255a2.375 2.375 0 0 1-4.25 1.458A2.37 2.37 0 0 1 9.875 8 2.37 2.37 0 0 1 8 7.083 2.37 2.37 0 0 1 6.125 8a2.37 2.37 0 0 1-1.875-.917A2.375 2.375 0 0 1 0 5.625V5.37a1.5 1.5 0 0 1 .361-.976zm1.78 4.275a1.375 1.375 0 0 0 2.75 0 .5.5 0 0 1 1 0 1.375 1.375 0 0 0 2.75 0 .5.5 0 0 1 1 0 1.375 1.375 0 1 0 2.75 0V5.37a.5.5 0 0 0-.12-.325L12.27 2H3.73L1.12 5.045A.5.5 0 0 0 1 5.37v.255a1.375 1.375 0 0 0 2.75 0 .5.5 0 0 1 1 0M1.5 8.5A.5.5 0 0 1 2 9v6h1v-5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v5h6V9a.5.5 0 0 1 1 0v6h.5a.5.5 0 0 1 0 1H.5a.5.5 0 0 1 0-1H1V9a.5.5 0 0 1 .5-.5M4 15h3v-5H4zm5-5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1zm3 0h-2v3h2z' },
  { key: 'delivery', label: 'Delivery', hint: 'You deliver to buyers',
    icon: 'M0 3.5A1.5 1.5 0 0 1 1.5 2h9A1.5 1.5 0 0 1 12 3.5V5h1.02a1.5 1.5 0 0 1 1.17.563l1.481 1.85a1.5 1.5 0 0 1 .329.938V10.5a1.5 1.5 0 0 1-1.5 1.5H14a2 2 0 1 1-4 0H5a2 2 0 1 1-3.998-.085A1.5 1.5 0 0 1 0 10.5zm1.294 7.456A2 2 0 0 1 4.732 11h5.536a2 2 0 0 1 .732-.732V3.5a.5.5 0 0 0-.5-.5h-9a.5.5 0 0 0-.5.5v7a.5.5 0 0 0 .294.456M12 10a2 2 0 0 1 1.732 1h.768a.5.5 0 0 0 .5-.5V8.35a.5.5 0 0 0-.11-.312l-1.48-1.85A.5.5 0 0 0 13.02 6H12zm-9 1a1 1 0 1 0 0 2 1 1 0 0 0 0-2m9 0a1 1 0 1 0 0 2 1 1 0 0 0 0-2' },
]
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

// ---- one order slot for every product ----
const pad = (n) => String(n).padStart(2, '0')
const todayInput = (() => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` })()
const bulkSlot = ref({ date: '', time: '', capacity: 10 })
const addingSlot = ref(false)
const bulkSlotMessage = ref('')
const bulkSlotError = ref(false)
async function addSlotToAll() {
  bulkSlotError.value = false
  const start = new Date(`${bulkSlot.value.date}T${bulkSlot.value.time}`) // the seller's local time
  if (Number.isNaN(start.getTime()) || start.getTime() <= Date.now()) {
    bulkSlotError.value = true
    bulkSlotMessage.value = 'Choose a date and time in the future.'
    return
  }
  addingSlot.value = true
  try {
    const { data } = await axios.post(`${API_URL}/products/shop/${shop.value._id}/slots`, {
      start: start.toISOString(),
      capacity: bulkSlot.value.capacity,
    })
    const plural = (n) => `${n} product${n === 1 ? '' : 's'}`
    bulkSlotMessage.value = `Added to ${plural(data.added)}.` + (data.skipped ? ` ${plural(data.skipped)} already had this time.` : '')
    bulkSlot.value = { date: '', time: '', capacity: bulkSlot.value.capacity }
    loadProducts()
  } catch (err) {
    bulkSlotError.value = true
    bulkSlotMessage.value = err.response?.data?.message || 'Could not add the slot. Please try again.'
  } finally {
    addingSlot.value = false
  }
}

const recurring = ref(null) // the "Recurring slots" pop-up

// ---- close / reopen orders for a product (stop taking orders without deleting it) ----
const pausingId = ref('')
const pauseError = ref({})
async function togglePause(item) {
  const isAvailable = item.isAvailable === false // closed -> reopen, otherwise close
  pausingId.value = item._id
  pauseError.value = { ...pauseError.value, [item._id]: '' }
  try {
    const { data } = await axios.patch(`${API_URL}/products/${item._id}/availability`, { isAvailable })
    item.isAvailable = data.isAvailable
  } catch (err) {
    pauseError.value = { ...pauseError.value, [item._id]: err.response?.data?.error || 'Could not change it. Please try again.' }
  } finally {
    pausingId.value = ''
  }
}

// "View all slots": every product's slots grouped by start time (one row per time, products listed under it)
const slotView = ref('upcoming')
const slotGroups = computed(() => {
  const byTime = new Map()
  for (const product of products.value) {
    for (const slot of product.orderSlots || []) {
      const time = new Date(slot.start).getTime()
      if (Number.isNaN(time)) continue
      if (!byTime.has(time)) byTime.set(time, { time, items: [] })
      byTime.get(time).items.push({ id: `${product._id}-${slot._id || time}`, productId: product._id, name: product.name, capacity: slot.capacity ?? 10 })
    }
  }
  return [...byTime.values()].sort((a, b) => a.time - b.time)
})
// a time every product has (each product counted once)
const isAllProducts = (group) => products.value.length > 0 && new Set(group.items.map((i) => i.productId)).size === products.value.length
// "10", or "5-10" when the products have different limits
function capacityText(group) {
  const caps = group.items.map((i) => i.capacity)
  const low = Math.min(...caps)
  const high = Math.max(...caps)
  return low === high ? String(low) : `${low}-${high}`
}
const upcomingSlots = computed(() => slotGroups.value.filter((g) => g.time > Date.now()))
const pastSlots = computed(() => slotGroups.value.filter((g) => g.time <= Date.now()).reverse()) // newest first
const shownSlots = computed(() => (slotView.value === 'upcoming' ? upcomingSlots.value : pastSlots.value))

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
/* Order options (narrower) + Order slots side by side on wide screens, stacked on smaller ones */
.settings-row {
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(0, 3fr);
  gap: 1rem;
}
@media (max-width: 1199.98px) {
  .settings-row { grid-template-columns: 1fr; }
}
.settings-card {
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
  padding: 1.1rem 1.25rem;
  border: 1px solid var(--line);
  border-radius: 1.25rem;
  background: var(--surface-soft);
}
.settings-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 0.75rem;
}
.settings-title {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 600;
  color: var(--ink);
}
.settings-sub {
  margin: 0.15rem 0 0;
  font-size: 0.85rem;
  color: var(--muted);
}
/* "Saved" / "Saving..." / error, top right of Order options */
.save-pill {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  gap: 0.3rem;
  padding: 0.2rem 0.65rem;
  border-radius: 999px;
  background: #ddf1e4;
  font-size: 0.78rem;
  font-weight: 500;
  color: #23804a;
}
.save-pill.error {
  background: #fce1e3;
  color: #b8312f;
}
/* one white row per option: icon, name + hint, switch */
.option-list {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}
.option-row {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  margin: 0;
  padding: 0.7rem 0.9rem;
  border: 1px solid var(--line);
  border-radius: 1rem;
  background: var(--surface);
  cursor: pointer;
}
.option-icon {
  display: inline-grid;
  flex-shrink: 0;
  place-items: center;
  width: 38px;
  height: 38px;
  border-radius: 0.7rem;
  background: var(--ocean-soft);
  color: var(--ocean);
}
.option-text {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
}
.option-text strong {
  font-weight: 500;
  color: var(--ink);
}
.option-text small {
  font-size: 0.8rem;
  color: var(--muted);
}
.option-row .form-check-input {
  width: 2.6em;
  height: 1.4em;
  margin: 0;
  cursor: pointer;
}
/* Order slots: outlined "View all slots" pill, one row of inputs + button */
.view-slots-btn {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  gap: 0.4rem;
  padding: 0.35rem 0.9rem;
  border: 1px solid var(--ocean);
  border-radius: 999px;
  background: var(--surface);
  font-size: 0.85rem;
  color: var(--ocean-dark);
}
.view-slots-btn:hover {
  background: var(--ocean-soft);
  color: var(--ocean-dark);
}
.bulk-slot-form {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr) minmax(0, 1fr) auto;
  align-items: end;
  gap: 0.6rem;
}
.bulk-slot-form .form-control {
  min-width: 0;
  height: 42px;
  border-radius: 0.75rem;
  background: var(--surface);
}
.add-all-btn {
  height: 42px;
  padding: 0 1.1rem;
  border-radius: 0.75rem;
  white-space: nowrap;
}
@media (max-width: 575.98px) {
  .bulk-slot-form { grid-template-columns: 1fr 1fr; }
  .add-all-btn { grid-column: 1 / -1; }
}
.settings-foot {
  padding-top: 0.75rem;
  border-top: 1px solid var(--line);
}
.recurring-link {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  font-size: 0.92rem;
  font-weight: 500;
  color: var(--ocean-dark);
  text-decoration: none;
}
.recurring-link:hover {
  text-decoration: underline;
}

/* "All order slots" pop-up */
.slot-list {
  margin: 0;
  padding: 0;
  list-style: none;
}
.slot-row {
  display: grid;
  grid-template-columns: 200px minmax(0, 1fr);
  gap: 0.75rem;
  padding: 0.75rem 0;
  border-bottom: 1px solid var(--line);
}
.slot-row:last-child { border-bottom: 0; }
.slot-when {
  display: flex;
  flex-direction: column;
}
.slot-products {
  display: flex;
  flex-wrap: wrap;
  align-content: flex-start;
  gap: 0.35rem;
}
.slot-chip {
  padding: 0.15rem 0.6rem;
  border-radius: 999px;
  background: var(--tile);
  font-size: 0.8rem;
  color: var(--ink);
}
.slot-chip.all {
  background: var(--ocean-soft);
  color: var(--ocean-dark);
  font-weight: 600;
}
@media (max-width: 575.98px) {
  .slot-row { grid-template-columns: 1fr; gap: 0.35rem; }
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
/* orders closed: faded photo + "Orders closed" label */
.product-tile.paused .product-img {
  filter: grayscale(0.7);
  opacity: 0.6;
}
.paused-badge {
  position: absolute;
  top: 0.6rem;
  left: 0.6rem;
  padding: 0.15rem 0.6rem;
  border-radius: 999px;
  background: rgba(var(--navy-rgb), 0.85);
  font-size: 0.75rem;
  font-weight: 600;
  color: #fff;
}
.paused-note {
  margin: 0.4rem 0 0;
  font-size: 0.78rem;
  color: var(--muted);
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
