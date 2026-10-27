<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import axios from 'axios'
import { API_URL } from '@/utils/config'
import { useRoute } from 'vue-router'
import { CATEGORIES } from '@/utils/constants'
import { formatPrice } from '@/utils/format'
import { cleanMrtName, mapEmbedUrl, googleMapsLink } from '@/utils/googleMaps'
import ViewToggle from '@/components/ViewToggle.vue'

// Owner: Member 3 + Cheyenne - /map
// Left: list of shops (search + category). Right: Google Maps showing the selected shop's
// NEAREST MRT station (never the seller's home). Uses Google's embed link, so no API key is needed.
// The floating card on the map shows the selected shop's name, categories and details.
const shops = ref([])
const loadingShops = ref(true)
const listError = ref('')
const search = ref('')
const category = ref('All')
const selectedId = ref(null)
const filterOpen = ref(false) // category chips slide out of the Filter button
const route = useRoute()

// ---- left panel ----
const shownShops = computed(() => {
  const q = search.value.trim().toLowerCase()
  return shops.value.filter((shop) => {
    const cats = (shop.categories || []).map((c) => c.toLowerCase())
    if (category.value !== 'All' && !cats.includes(category.value.toLowerCase())) return false
    if (!q) return true
    return [shop.name, shop.nearestMrt, ...(shop.categories || [])].some((t) => (t || '').toLowerCase().includes(q))
  })
})
const selectedShop = computed(() => shops.value.find((s) => s._id === selectedId.value) || null)
const shopsAtSelectedMrt = computed(() => {
  const station = cleanMrtName(selectedShop.value?.nearestMrt).toLowerCase()
  return station ? shops.value.filter((shop) => cleanMrtName(shop.nearestMrt).toLowerCase() === station) : []
})
const selectedShopPosition = computed(() => shopsAtSelectedMrt.value.findIndex((shop) => shop._id === selectedId.value))
const preferredMrt = computed(() => String(route.query.mrt || '').trim())
const mapSubject = computed(() => selectedShop.value || (preferredMrt.value ? { nearestMrt: preferredMrt.value } : null))
const mapUrl = computed(() => mapEmbedUrl(mapSubject.value))

// keep a shop selected so the map is never empty (first one in the list)
watch(shownShops, (list) => {
  if (!list.some((s) => s._id === selectedId.value)) {
    const preferred = cleanMrtName(preferredMrt.value).toLowerCase()
    selectedId.value = (preferred && list.find((shop) => cleanMrtName(shop.nearestMrt).toLowerCase() === preferred)?._id) || list[0]?._id || null
  }
}, { immediate: true })

const stationLabel = (shop) => (cleanMrtName(shop?.nearestMrt) ? `${cleanMrtName(shop.nearestMrt)} MRT` : 'No MRT given')
const categoryLabel = (shop) => (shop.categories?.length ? shop.categories.join(', ') : 'No category yet')

// same colour for the same shop every time
const AVATAR_COLOURS = ['#24498a', '#5b86c5', '#13284b', '#1b3a70', '#3f6aa8', '#93b2dd', '#46577a', '#e3a63a'] // navy / blue palette
function avatarColour(name) {
  let hash = 0
  for (const ch of String(name)) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0
  return AVATAR_COLOURS[hash % AVATAR_COLOURS.length]
}

// the card can be closed to see the whole map; picking a shop shows it again
const showCard = ref(true)
let lastCardScrollAt = 0
function selectShop(shop) {
  selectedId.value = shop._id
  showCard.value = true
}

function cycleStationShop(event) {
  if (shopsAtSelectedMrt.value.length < 2) return
  const now = Date.now()
  if (now - lastCardScrollAt < 350) return
  lastCardScrollAt = now
  const direction = event.deltaY > 0 ? 1 : -1
  const current = Math.max(0, selectedShopPosition.value)
  const next = Math.min(shopsAtSelectedMrt.value.length - 1, Math.max(0, current + direction))
  selectedId.value = shopsAtSelectedMrt.value[next]._id
}

onMounted(async () => {
  try {
    const res = await axios.get(`${API_URL}/shops/map`)
    shops.value = res.data
  } catch (err) {
    listError.value = 'Could not load shops. Please refresh the page.'
  } finally {
    loadingShops.value = false
  }
})
</script>

<template>
  <div>
    <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
      <div>
        <h2 class="page-title mb-0">Map</h2>
        <p class="text-muted small mb-0">Pick a shop to see its nearest MRT station on the map.</p>
      </div>
      <ViewToggle />
    </div>

    <!-- search + category -->
    <div class="d-flex flex-wrap gap-2 mb-3">
      <div class="search-box flex-grow-1">
        <svg class="search-icon" width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
          <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001q.044.06.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1 1 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0" />
        </svg>
        <input v-model="search" type="search" class="form-control" placeholder="Search by shop name, MRT or category" aria-label="Search shops" />
      </div>
      <!-- Filter button: click to slide the category chips out (and back in) -->
      <div class="filter-group" @keydown.esc="filterOpen = false">
        <Transition name="slide-chips">
          <div v-if="filterOpen" id="category-chips" class="chips" role="group" aria-label="Filter by category">
            <button v-for="(c, i) in ['All', ...CATEGORIES]" :key="c" type="button" class="chip" :style="{ '--i': i }"
              :class="{ active: category === c }" :aria-pressed="category === c" @click="category = c">
              {{ c }}
            </button>
          </div>
        </Transition>
        <button type="button" class="filter-btn" :class="{ open: filterOpen, filtered: category !== 'All' }"
          :aria-expanded="filterOpen" aria-controls="category-chips" @click="filterOpen = !filterOpen">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
            <path d="M6 10.5a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 0 1h-3a.5.5 0 0 1-.5-.5m-2-3a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 0 1h-7a.5.5 0 0 1-.5-.5m-2-3a.5.5 0 0 1 .5-.5h11a.5.5 0 0 1 0 1h-11a.5.5 0 0 1-.5-.5" />
          </svg>
          Filter
          <!-- shows the chosen category even when the chips are hidden -->
          <span v-if="category !== 'All'" class="filter-tag">{{ category }}</span>
        </button>
      </div>
    </div>

    <div class="map-shell">
      <!-- left: shop list -->
      <div class="shop-list">
        <p v-if="loadingShops" class="text-muted small p-2">Loading shops...</p>
        <p v-else-if="listError" class="text-danger small p-2">{{ listError }}</p>
        <p v-else-if="shownShops.length === 0" class="text-muted small p-2">No shops match your search.</p>
        <button v-for="shop in shownShops" :key="shop._id" type="button" class="shop-item"
          :class="{ selected: shop._id === selectedId }" @click="selectShop(shop)">
          <span class="avatar" :style="{ backgroundColor: avatarColour(shop.name) }" aria-hidden="true">
            {{ shop.name.charAt(0).toUpperCase() }}
          </span>
          <span class="flex-grow-1 min-w-0 text-start">
            <span class="d-block fw-semibold clamp-1">{{ shop.name }}</span>
            <span class="d-block meta clamp-1">{{ stationLabel(shop) }} &middot; {{ categoryLabel(shop) }}</span>
          </span>
          <span v-if="shop.minPrice !== null" class="price text-nowrap">
            <span class="from">from</span> {{ formatPrice(shop.minPrice) }}
          </span>
        </button>
      </div>

      <!-- right: the map (Google embed, no API key) -->
      <div class="map-area">
        <iframe v-if="mapUrl" :key="mapUrl" :src="mapUrl" class="map" :title="`Map of ${stationLabel(selectedShop)}`"
          loading="lazy" referrerpolicy="no-referrer-when-downgrade" allowfullscreen></iframe>
        <div v-else class="map-message">
          <h6 class="mb-1">{{ selectedShop ? 'No location for this shop' : 'No shop selected' }}</h6>
          <p class="small mb-0">{{ selectedShop ? 'The seller has not added their nearest MRT yet.' : 'Pick a shop from the list.' }}</p>
        </div>

        <!-- details of the selected shop -->
        <div v-if="selectedShop && showCard" class="detail-card" @wheel.prevent="cycleStationShop">
          <button type="button" class="btn-close close-btn" aria-label="Close" @click="showCard = false"></button>
          <div class="d-flex align-items-center gap-2 flex-wrap mb-2 pe-4">
            <span class="station-chip"><span class="dot"></span>{{ stationLabel(selectedShop) }}</span>
            <span v-if="shopsAtSelectedMrt.length > 1" class="small text-muted">{{ selectedShopPosition + 1 }} / {{ shopsAtSelectedMrt.length }} · scroll for more shops</span>
            <a v-if="googleMapsLink(selectedShop)" :href="googleMapsLink(selectedShop)" target="_blank"
              rel="noopener" class="small link-secondary">Open in Google Maps</a>
          </div>
          <h5 class="mb-1">{{ selectedShop.name }}</h5>
          <div class="d-flex flex-wrap gap-1 mb-3">
            <span v-for="c in selectedShop.categories" :key="c" class="badge text-bg-light border">{{ c }}</span>
            <span v-if="!selectedShop.categories?.length" class="small text-muted">No category yet</span>
          </div>
          <div class="d-flex gap-4 mb-3">
            <div>
              <div class="stat">{{ selectedShop.minPrice !== null ? formatPrice(selectedShop.minPrice) : '-' }}</div>
              <div class="stat-label">Starting price</div>
            </div>
            <div>
              <div class="stat">{{ selectedShop.stats?.reviewCount ? `${selectedShop.stats.avgRating.toFixed(1)} ★` : 'New' }}</div>
              <div class="stat-label">{{ selectedShop.stats?.reviewCount || 0 }} {{ selectedShop.stats?.reviewCount === 1 ? 'review' : 'reviews' }}</div>
            </div>
            <div>
              <div class="stat">{{ selectedShop.listingCount }}</div>
              <div class="stat-label">{{ selectedShop.listingCount === 1 ? 'Listing' : 'Listings' }}</div>
            </div>
          </div>
          <RouterLink :to="`/shops/${selectedShop._id}`" class="btn btn-brand w-100">View shop</RouterLink>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.search-box {
  position: relative;
  min-width: 240px;
}
.search-icon {
  position: absolute;
  top: 50%;
  left: 0.85rem;
  transform: translateY(-50%);
  color: var(--muted);
  pointer-events: none;
}
.search-box .form-control {
  height: 100%;
  padding-left: 2.2rem;
  border-radius: 999px;
}
.filter-group {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.filter-btn {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  gap: 0.4rem;
  padding: 0.45rem 1rem;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: #fff;
  font-weight: 500;
  color: var(--ink);
  transition: background 0.2s ease, color 0.2s ease, border-color 0.2s ease;
}
.filter-btn:hover {
  border-color: var(--brand);
  color: var(--brand);
}
.filter-btn.open {
  border-color: var(--brand);
  background: var(--brand);
  color: #fff;
}
.filter-btn svg {
  transition: transform 0.3s ease;
}
.filter-btn.open svg {
  transform: rotate(180deg);
}
.filter-tag {
  padding: 0.05rem 0.5rem;
  border-radius: 999px;
  background: rgba(var(--brand-rgb), 0.12);
  font-size: 0.75rem;
  color: var(--brand-dark);
}
.filter-btn.open .filter-tag {
  background: rgba(255, 255, 255, 0.25);
  color: #fff;
}
.chips {
  display: flex;
  gap: 0.25rem;
  padding: 0.25rem;
  overflow: hidden;
  white-space: nowrap;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: #fff;
}
/* the panel grows out of the Filter button... */
.slide-chips-enter-active,
.slide-chips-leave-active {
  transition: max-width 0.4s ease, max-height 0.4s ease, opacity 0.3s ease, transform 0.4s ease;
}
.slide-chips-enter-from,
.slide-chips-leave-to {
  max-width: 0;
  max-height: 0;
  opacity: 0;
  transform: translateX(24px);
}
.slide-chips-enter-to,
.slide-chips-leave-from {
  max-width: 900px;
  max-height: 200px;
}
/* ...and the chips pop in one after another */
.slide-chips-enter-active .chip {
  animation: chip-in 0.35s ease both;
  animation-delay: calc(var(--i) * 40ms + 80ms);
}
@keyframes chip-in {
  from {
    opacity: 0;
    transform: translateX(12px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}
@media (prefers-reduced-motion: reduce) {
  .slide-chips-enter-active,
  .slide-chips-leave-active,
  .slide-chips-enter-active .chip {
    transition: none;
    animation: none;
  }
}
/* phones: Filter button and chips get their own line, chips wrap */
@media (max-width: 767.98px) {
  .filter-group {
    width: 100%;
    flex-wrap: wrap;
    justify-content: flex-end;
  }
  .chips {
    order: 1;
    flex-wrap: wrap;
    width: 100%;
    border-radius: 1rem;
  }
}
.chip {
  padding: 0.3rem 0.85rem;
  border: 0;
  border-radius: 999px;
  background: transparent;
  font-size: 0.875rem;
  color: var(--ink-soft);
}
.chip:hover {
  background: var(--surface-hover);
}
.chip.active {
  background: var(--brand);
  color: #fff;
}

/* the white panel holding list + map */
.map-shell {
  display: grid;
  grid-template-columns: 320px minmax(0, 1fr);
  gap: 0.75rem;
  height: calc(100vh - 260px);
  min-height: 520px;
  padding: 0.75rem;
  border: 1px solid var(--line);
  border-radius: 1.25rem;
  background: #fff;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.06);
}
.shop-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  overflow-y: auto;
  padding-right: 0.25rem;
}
.shop-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
  padding: 0.7rem 0.8rem;
  border: 1px solid var(--line);
  border-radius: 0.9rem;
  background: var(--surface-soft);
  font-size: 0.9rem;
  color: var(--ink);
  transition: background 0.15s ease;
}
.shop-item:hover {
  background: var(--surface-hover);
}
.shop-item.selected {
  border-color: var(--brand);
  background: var(--brand);
  color: #fff;
}
.shop-item.selected .meta,
.shop-item.selected .from {
  color: rgba(255, 255, 255, 0.8);
}
.avatar {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: 2px solid #fff;
  border-radius: 50%;
  font-weight: 700;
  color: #fff;
}
.meta {
  font-size: 0.75rem;
  color: var(--muted);
}
.price {
  font-weight: 600;
}
.from {
  font-size: 0.7rem;
  font-weight: 400;
  color: var(--muted);
}
.min-w-0 {
  min-width: 0;
}

.map-area {
  position: relative;
  overflow: hidden;
  border-radius: 1rem;
  background: var(--surface-hover);
}
.map {
  display: block;
  width: 100%;
  height: 100%;
  border: 0;
}
.map-message {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  text-align: center;
  color: var(--ink-soft);
}

/* floating card at the bottom-left of the map (like the design) */
.detail-card {
  position: absolute;
  left: 1rem;
  bottom: 1rem;
  width: min(340px, calc(100% - 2rem));
  padding: 1rem 1.1rem;
  border: 1px solid rgba(255, 255, 255, 0.7);
  border-radius: 1.1rem;
  background: rgba(255, 255, 255, 0.86);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.18);
  backdrop-filter: blur(10px);
}
.close-btn {
  position: absolute;
  top: 0.75rem;
  right: 0.75rem;
  font-size: 0.7rem;
}
.station-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.15rem 0.6rem;
  border-radius: 999px;
  background: var(--surface-hover);
  font-size: 0.75rem;
}
.dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--brand);
}
.stat {
  font-size: 1.3rem;
  font-weight: 600;
  line-height: 1.2;
}
.stat-label {
  font-size: 0.75rem;
  color: var(--muted);
}

/* phones: map on top, list underneath */
@media (max-width: 767.98px) {
  .map-shell {
    grid-template-columns: 1fr;
    height: auto;
  }
  .map-area {
    order: -1;
    height: 60vh;
    min-height: 380px;
  }
  .shop-list {
    max-height: 50vh;
  }
}

</style>
