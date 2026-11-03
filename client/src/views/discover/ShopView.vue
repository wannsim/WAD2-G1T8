<template>
  <PageSkeleton v-if="loading" variant="shop" label="Loading shop" />
  <div v-else-if="loadError" class="alert alert-warning">
    {{ loadError }} <RouterLink to="/browse">Back to browse</RouterLink>
  </div>

  <div class="mb-5" v-else-if="shop">
    <!-- ===== channel header: banner, profile picture, name, follow ===== -->
    <ShopHeader :shop="shop" :product-count="products.length" :is-owner="isOwner" @more="tab = 'about'">
      <template #actions>
        <RouterLink to="/profile" class="btn btn-primary owner-btn">Edit profile</RouterLink>
      </template>
    </ShopHeader>

    <!-- ===== tabs ===== -->
    <nav class="shop-tabs" aria-label="Shop sections">
      <button v-for="t in TABS" :key="t.key" type="button" class="shop-tab" :class="{ active: tab === t.key }"
        :aria-current="tab === t.key ? 'page' : undefined" @click="tab = t.key">{{ t.label }}</button>
    </nav>

    <p v-if="pinError" class="small text-danger">{{ pinError }}</p>

    <!-- ===== Home: rows of products (like a channel's "Videos" / "Popular videos") ===== -->
    <template v-if="tab === 'home'">
      <p v-if="products.length === 0" class="text-muted">This shop has no listings yet.</p>
      <section v-for="row in homeRows" :key="row.key" class="row-section">
        <div class="d-flex justify-content-between align-items-baseline mb-3">
          <h2 class="row-title">{{ row.title }}</h2>
          <button type="button" class="see-all" @click="openProducts(row.sort)">See all</button>
        </div>
        <div class="row-wrap">
          <button v-if="overflowing[row.key]" type="button" class="row-arrow prev" aria-label="Scroll left" @click="scrollRow($event, -1)">&lsaquo;</button>
          <div :ref="(el) => (rowEls[row.key] = el)" class="product-row">
            <div v-for="item in row.items" :key="item._id" class="row-item">
              <ProductCard :product="item" no-swipe :pinned="isPinned(item)" :pinnable="isOwner" :pin-busy="pinning"
                @toggle-pin="togglePin(item)" />
            </div>
          </div>
          <button v-if="overflowing[row.key]" type="button" class="row-arrow next" aria-label="Scroll right" @click="scrollRow($event, 1)">&rsaquo;</button>
        </div>
      </section>
    </template>

    <!-- ===== Products: everything, with Latest / Popular / Price chips ===== -->
    <template v-else-if="tab === 'products'">
      <div class="d-flex flex-wrap gap-2 mb-4">
        <button v-for="s in SORTS" :key="s.key" type="button" class="sort-chip" :class="{ active: sort === s.key }"
          @click="sort = s.key">{{ s.label }}</button>
      </div>
      <p v-if="products.length === 0" class="text-muted">This shop has no listings yet.</p>
      <p v-if="isOwner && products.length" class="small text-muted mb-2">Click the pin on a product to show it first (up to 3).</p>
      <div class="card-grid">
        <div v-for="item in sortedForTab" :key="item._id">
          <ProductCard :product="item" :pinned="isPinned(item)" :pinnable="isOwner" :pin-busy="pinning" @toggle-pin="togglePin(item)">
            <!-- only the shop owner can edit -->
            <button v-if="isOwner" class="btn btn-outline-primary btn-sm" @click="openEditModal(item)">Edit</button>
          </ProductCard>
        </div>
      </div>
    </template>

    <!-- ===== Reviews ===== -->
    <section v-else-if="tab === 'reviews'">
      <ReviewList :shop-id="shop._id" />
    </section>

    <!-- ===== About ===== -->
    <section v-else class="about" aria-labelledby="about-title">
      <h2 id="about-title" class="about-title">About</h2>
      <p v-if="shop.description" class="about-text">{{ shop.description }}</p>

      <!-- six stats in a row: big value, small label underneath -->
      <dl class="about-stats" aria-label="Shop stats">
        <div v-for="stat in aboutStats" :key="stat.label" class="about-stat">
          <dt>{{ stat.label }}</dt>
          <dd>{{ stat.value }}<small v-if="stat.extra"> {{ stat.extra }}</small></dd>
        </div>
      </dl>

      <!-- details: icon tile + label + value -->
      <dl class="about-details">
        <div v-for="item in aboutDetails" :key="item.label" class="about-detail">
          <span class="detail-icon" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor"><path v-for="(d, i) in item.icon" :key="i" :d="d" /></svg>
          </span>
          <div class="min-w-0">
            <dt>{{ item.label }}</dt>
            <dd v-if="item.chips" class="detail-chips">
              <span v-for="chip in item.chips" :key="chip" class="detail-chip">{{ chip }}</span>
            </dd>
            <dd v-else class="text-break">{{ item.value }}</dd>
          </div>
        </div>
      </dl>

      <!-- certificate photos uploaded on the seller's profile page -->
      <div v-if="shop.certificationFiles && shop.certificationFiles.length" class="cert-photos">
        <p class="cert-heading">Certificate photos</p>
        <div class="d-flex flex-wrap gap-2">
          <a v-for="cert in shop.certificationFiles" :key="cert._id" :href="certImageUrl(cert)" target="_blank" :title="cert.name">
            <img :src="certImageUrl(cert)" :alt="cert.name" class="cert-img" loading="lazy" decoding="async">
          </a>
        </div>
      </div>
    </section>

    <!-- only the shop owner can open this -->
    <EditProductModal v-if="isOwner" ref="editModal" @saved="onProductSaved" />
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { useRoute } from 'vue-router'
import axios from 'axios'
import { API_URL } from '@/utils/config'
import { currentUser } from '@/utils/auth'
import ProductCard from '@/components/ProductCard.vue'
import ShopHeader from '@/components/ShopHeader.vue'
import EditProductModal from '@/components/EditProductModal.vue'
import ReviewList from '@/components/ReviewList.vue'
import { shortNumber } from '@/utils/format'

const shop = ref(null)
const products = ref([])
const reviews = ref([]) // only used to find the most popular products

// Owner: Member 3 - /shops/:id  the public page of one shop (buyers land here from a product page)
// Laid out like a YouTube channel: header (ShopHeader), tabs, rows of products.
const route = useRoute()
const loading = ref(true)
const loadError = ref('')

const isOwner = computed(() => !!shop.value && !!currentUser.value && String(shop.value.owner) === currentUser.value._id)
const pinnedIds = computed(() => (shop.value?.pinnedProducts || []).map(String))
const isPinned = (item) => pinnedIds.value.includes(item._id)
// pinned products first (in the order they were pinned), the rest stay newest first
const pinRank = (item) => (isPinned(item) ? pinnedIds.value.indexOf(item._id) : pinnedIds.value.length)
const sortedProducts = computed(() => [...products.value].sort((a, b) => pinRank(a) - pinRank(b)))

// ---------- header (the rest is in ShopHeader) ----------
const fulfilment = computed(() => {
  const ways = [shop.value?.pickup && 'Pickup', shop.value?.delivery && 'Delivery'].filter(Boolean)
  return ways.length ? ways.join(' or ') : 'Ask the seller'
})
// About tab: short stat values ("4.5 (61)", "< 4 hrs", "Oct 2026") so six fit in one row
function shortResponse(mins) {
  if (!mins) return 'New'
  if (mins < 60) return `< ${Math.max(1, Math.round(mins))} mins`
  const hours = Math.round(mins / 60)
  if (mins < 1440) return `< ${hours} ${hours === 1 ? 'hr' : 'hrs'}`
  return 'Days'
}
const aboutStats = computed(() => {
  const stats = shop.value?.stats || {}
  return [
    stats.reviewCount
      ? { label: 'Ratings', value: Number(stats.avgRating).toFixed(1), extra: `(${shortNumber(stats.reviewCount)})` }
      : { label: 'Ratings', value: 'New' },
    { label: 'Orders fulfilled', value: stats.fulfilmentRate ? `${Math.round(stats.fulfilmentRate * 100)}%` : '-' },
    { label: 'Response time', value: shortResponse(stats.avgResponseMins) },
    { label: 'Products', value: String(products.value.length) },
    { label: 'Followers', value: shortNumber(stats.followerCount ?? shop.value?.followers?.length ?? 0) },
    { label: 'Member since', value: shop.value?.createdAt ? new Date(shop.value.createdAt).toLocaleDateString('en-SG', { month: 'short', year: 'numeric' }) : '-' },
  ]
})
// bootstrap-icons paths for the detail tiles
const ABOUT_ICONS = {
  pin: ['M12.166 8.94c-.524 1.062-1.234 2.12-1.96 3.07A32 32 0 0 1 8 14.58a32 32 0 0 1-2.206-2.57c-.726-.95-1.436-2.008-1.96-3.07C3.304 7.867 3 6.862 3 6a5 5 0 0 1 10 0c0 .862-.305 1.867-.834 2.94M8 16s6-5.686 6-10A6 6 0 0 0 2 6c0 4.314 6 10 6 10', 'M8 8a2 2 0 1 1 0-4 2 2 0 0 1 0 4m0 1a3 3 0 1 0 0-6 3 3 0 0 0 0 6'],
  truck: ['M0 3.5A1.5 1.5 0 0 1 1.5 2h9A1.5 1.5 0 0 1 12 3.5V5h1.02a1.5 1.5 0 0 1 1.17.563l1.481 1.85a1.5 1.5 0 0 1 .329.938V10.5a1.5 1.5 0 0 1-1.5 1.5H14a2 2 0 1 1-4 0H5a2 2 0 1 1-3.998-.085A1.5 1.5 0 0 1 0 10.5zm1.294 7.456A2 2 0 0 1 4.732 11h5.536a2 2 0 0 1 .732-.732V3.5a.5.5 0 0 0-.5-.5h-9a.5.5 0 0 0-.5.5v7a.5.5 0 0 0 .294.456M12 10a2 2 0 0 1 1.732 1h.768a.5.5 0 0 0 .5-.5V8.35a.5.5 0 0 0-.11-.312l-1.48-1.85A.5.5 0 0 0 13.02 6H12zm-9 1a1 1 0 1 0 0 2 1 1 0 0 0 0-2m9 0a1 1 0 1 0 0 2 1 1 0 0 0 0-2'],
  briefcase: ['M6.5 1A1.5 1.5 0 0 0 5 2.5V3H1.5A1.5 1.5 0 0 0 0 4.5v8A1.5 1.5 0 0 0 1.5 14h13a1.5 1.5 0 0 0 1.5-1.5v-8A1.5 1.5 0 0 0 14.5 3H11v-.5A1.5 1.5 0 0 0 9.5 1zm0 1h3a.5.5 0 0 1 .5.5V3H6v-.5a.5.5 0 0 1 .5-.5m1.886 6.914L15 7.151V12.5a.5.5 0 0 1-.5.5h-13a.5.5 0 0 1-.5-.5V7.15l6.614 1.764a1.5 1.5 0 0 0 .772 0M1.5 4h13a.5.5 0 0 1 .5.5v1.616L8.129 7.948a.5.5 0 0 1-.258 0L1 6.116V4.5a.5.5 0 0 1 .5-.5'],
  award: ['M9.669.864 8 0 6.331.864l-1.858.282-.842 1.68-1.337 1.32L2.6 6l-.306 1.854 1.337 1.32.842 1.68 1.858.282L8 12l1.669-.864 1.858-.282.842-1.68 1.337-1.32L13.4 6l.306-1.854-1.337-1.32-.842-1.68zm1.196 1.193.684 1.365 1.086 1.072L12.387 6l.248 1.506-1.086 1.072-.684 1.365-1.51.229L8 10.874l-1.355-.702-1.51-.229-.684-1.365-1.086-1.072L3.614 6l-.25-1.506 1.087-1.072.684-1.365 1.51-.229L8 1.126l1.356.702z', 'M4 11.794V16l4-1 4 1v-4.206l-2.018.306L8 13.126 6.018 12.1z'],
  tag: ['M6 4.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0m-1 0a.5.5 0 1 0-1 0 .5.5 0 0 0 1 0', 'M2 1h4.586a1 1 0 0 1 .707.293l7 7a1 1 0 0 1 0 1.414l-4.586 4.586a1 1 0 0 1-1.414 0l-7-7A1 1 0 0 1 1 6.586V2a1 1 0 0 1 1-1m0 5.586 7 7L13.586 9l-7-7H2z'],
}
// only the details the seller filled in are shown
const aboutDetails = computed(() => {
  const s = shop.value || {}
  return [
    s.nearestMrt && { label: 'Nearest MRT', value: s.nearestMrt, icon: ABOUT_ICONS.pin },
    { label: 'Getting your order', value: fulfilment.value, icon: ABOUT_ICONS.truck },
    s.experience && { label: 'Experience', value: s.experience, icon: ABOUT_ICONS.briefcase },
    s.certifications?.length && { label: 'Certifications', value: s.certifications.join(', '), icon: ABOUT_ICONS.award },
    s.categories?.length && { label: 'Categories', chips: s.categories, icon: ABOUT_ICONS.tag },
  ].filter(Boolean)
})

// ---------- tabs ----------
const TABS = [
  { key: 'home', label: 'Home' },
  { key: 'products', label: 'Products' },
  { key: 'reviews', label: 'Reviews' },
  { key: 'about', label: 'About' },
]
const tab = ref('home')

// popular = most reviewed, then best rated (from this shop's reviews)
const popularity = computed(() => {
  const score = {}
  for (const r of reviews.value) {
    const id = String(r.product?._id || r.product || '')
    if (!id) continue
    score[id] ??= { count: 0, total: 0 }
    score[id].count++
    score[id].total += r.rating || 0
  }
  return score
})
const popularRank = (item) => {
  const s = popularity.value[item._id]
  return s ? s.count * 10 + s.total / s.count : 0
}
const popularProducts = computed(() =>
  products.value.filter((p) => popularRank(p) > 0).sort((a, b) => popularRank(b) - popularRank(a)))

// Home: "Products" (pinned first, then newest) and "Popular products" (only once there are reviews)
const homeRows = computed(() => {
  const rows = []
  if (products.value.length) rows.push({ key: 'all', title: 'Products', sort: 'latest', items: sortedProducts.value.slice(0, 12) })
  if (popularProducts.value.length) rows.push({ key: 'popular', title: 'Popular products', sort: 'popular', items: popularProducts.value.slice(0, 12) })
  return rows
})

// Products tab sort chips
const SORTS = [
  { key: 'latest', label: 'Latest' },
  { key: 'popular', label: 'Popular' },
  { key: 'price', label: 'Price: low to high' },
]
const sort = ref('latest')
const sortedForTab = computed(() => {
  if (sort.value === 'popular') return [...products.value].sort((a, b) => popularRank(b) - popularRank(a))
  if (sort.value === 'price') return [...products.value].sort((a, b) => a.price - b.price)
  return sortedProducts.value
})
function openProducts(sortKey) {
  sort.value = sortKey
  tab.value = 'products'
}

// the ‹ › buttons only show when a row has more products than fit on screen
const rowEls = {}
const overflowing = ref({})
function checkOverflow() {
  const result = {}
  for (const [key, el] of Object.entries(rowEls)) if (el) result[key] = el.scrollWidth > el.clientWidth + 4
  overflowing.value = result
}
watch([homeRows, tab], () => nextTick(checkOverflow))
onMounted(() => window.addEventListener('resize', checkOverflow))
onBeforeUnmount(() => window.removeEventListener('resize', checkOverflow))

// the ‹ › buttons on a row scroll it by about one screen width
function scrollRow(event, direction) {
  const row = event.currentTarget.parentElement.querySelector('.product-row')
  row.scrollBy({ left: direction * row.clientWidth * 0.85, behavior: 'smooth' })
}

// ---------- pins (shop owner) ----------
const pinning = ref(false)
const pinError = ref('')
async function togglePin(item) {
  pinError.value = ''
  pinning.value = true
  try {
    const res = await axios.put(`${API_URL}/shops/${shop.value._id}/pin`, { user: currentUser.value._id, productId: item._id })
    shop.value.pinnedProducts = res.data.pinnedProducts
  } catch (err) {
    pinError.value = err.response?.data?.message || err.message
  } finally {
    pinning.value = false
  }
}
const certImageUrl = (cert) => `${API_URL}/shops/${shop.value._id}/certs/${cert._id}/image`

onMounted(async () => {
  try {
    // load the shop and its products at the same time
    const [shopRes, prodRes] = await Promise.all([
      axios.get(`${API_URL}/shops/${route.params.id}`),
      axios.get(`${API_URL}/products/shop/${route.params.id}`),
    ])
    shop.value = shopRes.data
    products.value = prodRes.data
  } catch (error) {
    loadError.value = error.response?.status === 404 ? 'This shop could not be found.' : 'Could not load this shop. Please try again.'
    console.error("Error loading shop data", error)
  } finally {
    loading.value = false
  }
  // reviews only decide the "Popular" order, so the page doesn't wait for them
  if (shop.value) {
    axios.get(`${API_URL}/reviews/shop/${shop.value._id}`).then((res) => (reviews.value = res.data)).catch(() => {})
  }
})

const editModal = ref(null)
const openEditModal = (item) => editModal.value.open(item)
const onProductSaved = (updated) => {
  const index = products.value.findIndex((p) => p._id === updated._id)
  if (index !== -1) products.value[index] = updated
}
</script>

<style scoped>
/* ---------- tabs ---------- */
.shop-tabs {
  display: flex;
  gap: 0.5rem;
  margin: 1rem 0 2.25rem;
  border-bottom: 1px solid var(--line);
  overflow-x: auto;
}
.shop-tab {
  flex-shrink: 0;
  padding: 0.7rem 1rem;
  border: 0;
  border-bottom: 3px solid transparent;
  background: none;
  font-size: 1.05rem;
  font-weight: 500;
  color: var(--muted);
}
.shop-tab:hover {
  color: var(--ink);
}
.shop-tab.active {
  border-bottom-color: var(--navy);
  color: var(--navy);
}

/* Products tab: more room between cards than the default grid */
.card-grid {
  gap: 1.75rem;
}

/* ---------- Home rows ---------- */
.row-section {
  padding-bottom: 2.5rem;
  margin-bottom: 2.5rem;
  border-bottom: 1px solid var(--line);
}
.row-section:last-child {
  border-bottom: 0;
}
.row-title {
  margin: 0;
  font-size: 1.4rem;
  font-weight: 700;
  color: var(--navy);
}
.see-all {
  border: 0;
  background: none;
  font-weight: 600;
  color: var(--ocean);
}
.row-wrap {
  position: relative;
}
.product-row {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: minmax(220px, 250px);
  gap: 1.5rem;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  scrollbar-width: none;
  padding: 0.25rem 0.1rem 0.5rem;
}
.product-row::-webkit-scrollbar {
  display: none;
}
.row-item {
  min-width: 0;
  scroll-snap-align: start;
}
.row-arrow {
  position: absolute;
  top: 40%;
  z-index: 3;
  width: 40px;
  height: 40px;
  border: 0;
  border-radius: 50%;
  background: var(--surface);
  box-shadow: 0 4px 14px rgba(var(--navy-rgb), 0.18);
  font-size: 1.5rem;
  line-height: 1;
  color: var(--navy);
}
.row-arrow.prev { left: -14px; }
.row-arrow.next { right: -14px; }
@media (hover: none) {
  .row-arrow { display: none; } /* phones: just swipe the row */
}

/* ---------- Products chips ---------- */
.sort-chip {
  padding: 0.4rem 1rem;
  border: 0;
  border-radius: 0.6rem;
  background: var(--tile);
  font-weight: 500;
  color: var(--ink);
}
.sort-chip.active {
  background: var(--navy);
  color: #fff;
}

/* ---------- About ---------- */
.about {
  padding: 2rem 2.25rem;
  border-radius: 1.5rem;
  background: var(--surface-soft);
}
.about-title {
  margin: 0 0 0.3rem;
  font-size: 1.6rem;
  font-weight: 700;
  color: var(--navy);
}
.about-text {
  margin: 0 0 2rem;
  white-space: pre-line;
  color: var(--ink);
}
/* stats: one row of six, thin lines between them */
.about-stats {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  margin: 0;
  padding-bottom: 1.75rem;
  border-bottom: 1px solid var(--line);
}
.about-stat {
  display: flex;
  flex-direction: column-reverse; /* label (dt) comes first for screen readers, but shows under the value */
  padding: 0.1rem 1.25rem;
  border-left: 1px solid var(--line);
}
.about-stat:first-child {
  padding-left: 0;
  border-left: 0;
}
.about-stat dd {
  margin: 0;
  font-size: 1.45rem;
  font-weight: 700;
  line-height: 1.25;
  color: var(--ocean);
  white-space: nowrap;
}
.about-stat dd small {
  font-size: 0.95rem;
  font-weight: 400;
  color: var(--ink-soft);
}
.about-stat dt {
  font-size: 0.85rem;
  font-weight: 400;
  color: var(--ink-soft);
}
/* details: three columns of icon + label + value */
.about-details {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1.75rem 2.25rem;
  margin: 1.75rem 0 0;
}
.about-detail {
  display: flex;
  align-items: flex-start;
  gap: 0.85rem;
}
.detail-icon {
  display: inline-grid;
  flex-shrink: 0;
  place-items: center;
  width: 44px;
  height: 44px;
  border-radius: 0.8rem;
  background: var(--ocean-soft);
  color: var(--ocean);
}
.about-detail dt {
  font-size: 0.85rem;
  font-weight: 400;
  color: var(--muted);
}
.about-detail dd {
  margin: 0.1rem 0 0;
  font-weight: 500;
  color: var(--ink);
}
.detail-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}
.detail-chip {
  padding: 0.15rem 0.75rem;
  border-radius: 999px;
  background: var(--ocean-soft);
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--ocean-dark);
}
.min-w-0 {
  min-width: 0;
}
.cert-photos {
  margin-top: 1.75rem;
  padding-top: 1.5rem;
  border-top: 1px solid var(--line);
}
.cert-heading {
  margin: 0 0 0.5rem;
  font-size: 0.85rem;
  color: var(--muted);
}
.cert-img {
  width: 80px;
  height: 80px;
  border-radius: 0.75rem;
  object-fit: cover;
  border: 1px solid var(--line);
}

/* smaller screens: 3 stats a row, then 2; details 2 columns, then 1 */
@media (max-width: 1199.98px) {
  .about-stats { grid-template-columns: repeat(3, minmax(0, 1fr)); row-gap: 1.5rem; }
  .about-stat:nth-child(3n + 1) { padding-left: 0; border-left: 0; }
}
@media (max-width: 991.98px) {
  .about-details { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 575.98px) {
  .about { padding: 1.5rem 1.25rem; }
  .about-stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .about-stat { padding-left: 1rem; border-left: 1px solid var(--line); }
  .about-stat:nth-child(odd) { padding-left: 0; border-left: 0; }
  .about-details { grid-template-columns: 1fr; }
}
</style>
