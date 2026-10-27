<template>
  <p v-if="loading" class="text-muted">Loading shop...</p>
  <div v-else-if="loadError" class="alert alert-warning">
    {{ loadError }} <RouterLink to="/browse">Back to browse</RouterLink>
  </div>

  <div class="mb-5" v-else-if="shop">
    <!-- ===== channel header: banner, profile picture, name, follow ===== -->
    <ShopHeader :shop="shop" :product-count="products.length" :is-owner="isOwner" @more="tab = 'about'">
      <template #actions>
        <RouterLink to="/profile" class="btn btn-primary owner-btn">Edit profile</RouterLink>
        <RouterLink to="/seller/shop" class="btn btn-outline-primary owner-btn">Manage products</RouterLink>
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
        <div class="d-flex justify-content-between align-items-baseline mb-2">
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
      <div class="d-flex flex-wrap gap-2 mb-3">
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
    <section v-else class="about card p-4">
      <h2 class="row-title mb-3">About</h2>
      <p v-if="shop.description" class="about-text">{{ shop.description }}</p>
      <dl class="about-list">
        <template v-if="shop.nearestMrt"><dt>Nearest MRT</dt><dd>{{ shop.nearestMrt }}</dd></template>
        <dt>Getting your order</dt><dd>{{ fulfilment }}</dd>
        <template v-if="shop.experience"><dt>Experience</dt><dd>{{ shop.experience }}</dd></template>
        <template v-if="shop.categories?.length"><dt>Categories</dt>
          <dd><span class="badge bg-secondary me-1" v-for="cat in shop.categories" :key="cat">{{ cat }}</span></dd>
        </template>
        <template v-if="shop.certifications?.length"><dt>Certifications</dt><dd>{{ shop.certifications.join(', ') }}</dd></template>
        <template v-if="shop.createdAt"><dt>Joined</dt><dd>{{ joined }}</dd></template>
      </dl>
      <!-- certificate photos uploaded on the seller's profile page -->
      <div v-if="shop.certificationFiles && shop.certificationFiles.length" class="d-flex flex-wrap gap-2 mt-2">
        <a v-for="cert in shop.certificationFiles" :key="cert._id" :href="certImageUrl(cert)" target="_blank" :title="cert.name">
          <img :src="certImageUrl(cert)" :alt="cert.name" class="cert-img" loading="lazy" decoding="async">
        </a>
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
const joined = computed(() => new Date(shop.value.createdAt).toLocaleDateString('en-SG', { month: 'long', year: 'numeric' }))

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
  margin-bottom: 1.5rem;
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

/* ---------- Home rows ---------- */
.row-section {
  padding-bottom: 1.75rem;
  margin-bottom: 1.75rem;
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
  gap: 1rem;
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
.about-text {
  white-space: pre-line;
}
.about-list {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 0.5rem 1.5rem;
  margin: 0;
}
.about-list dt {
  font-weight: 600;
  color: var(--ink-soft);
}
.about-list dd {
  margin: 0;
}
.cert-img {
  width: 80px;
  height: 80px;
  border-radius: 0.75rem;
  object-fit: cover;
  border: 1px solid var(--line);
}

/* phones: About details stack */
@media (max-width: 575.98px) {
  .about-list {
    grid-template-columns: 1fr;
  }
}
</style>
