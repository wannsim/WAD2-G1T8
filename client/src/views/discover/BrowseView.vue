<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import axios from 'axios'
import { API_URL } from '@/utils/config'
import { currentUser } from '@/utils/auth'
import { CATEGORIES } from '@/utils/constants'
import ShopCard from '@/components/ShopCard.vue'
import ViewToggle from '@/components/ViewToggle.vue'

// Owner: Member 3 - browse, search, filter, favourite
const router = useRouter()
const route = useRoute()
const q = ref('')
const category = ref(CATEGORIES.includes(route.query.category) ? route.query.category : '') // /browse?category=Meals (For you's "See all")
const maxPrice = ref('')
const sort = ref('latest')
const products = ref([])
const shops = ref([])
const savedIds = ref([])
const loading = ref(true) // first search still running -> skeleton, not "No products found"
const mapRoute = computed(() => currentUser.value?.preferredMrt
  ? { path: '/map', query: { mrt: currentUser.value.preferredMrt } }
  : '/map')

// sorting happens here on the page, on whatever the search + filters returned, so all three work together
const SORTS = [
  { value: 'latest', label: 'Latest to oldest' },
  { value: 'oldest', label: 'Oldest to latest' },
  { value: 'priceLow', label: 'Price: cheapest first' },
  { value: 'priceHigh', label: 'Price: most expensive first' },
  { value: 'name', label: 'Name: A to Z' },
]
const time = (p) => new Date(p.createdAt).getTime() || 0
const COMPARE = {
  latest: (a, b) => time(b) - time(a),
  oldest: (a, b) => time(a) - time(b),
  priceLow: (a, b) => a.price - b.price,
  priceHigh: (a, b) => b.price - a.price,
  name: (a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
}
const sortedProducts = computed(() => [...products.value].sort(COMPARE[sort.value]))

const hasChanges = computed(() => !!(q.value || category.value || maxPrice.value !== '' || sort.value !== 'latest'))

// one "Filters" button slides open category, max price, sort and Reset
const filtersOpen = ref(false)
const activeFilters = computed(() => [category.value, maxPrice.value !== '', sort.value !== 'latest'].filter(Boolean).length)

let lastRequest = 0 // typing fires many searches; only the newest answer is shown
async function search() {
  const requestId = ++lastRequest
  try {
    const response = await axios.get(`${API_URL}/discover`, {
      params: { q: q.value, category: category.value, maxPrice: maxPrice.value },
    })
    if (requestId !== lastRequest) return
    products.value = response.data.products
    shops.value = response.data.shops

  } catch (error) {
    console.log(error.message)
  } finally {
    loading.value = false
  }
}

// save the search term for the FYP (only on Search / Enter, not every keystroke)
function logSearch() {
  if (!currentUser.value || !q.value) return
  axios
    .post(`${API_URL}/feed/search`, { user: currentUser.value._id, term: q.value })
    .catch(() => { })
}

function submitSearch() {
  search()
  logSearch()
}

// Reset: clear the search, both filters and the sort
function resetAll() {
  q.value = ''
  category.value = ''
  maxPrice.value = ''
  sort.value = 'latest'
  if (route.query.category) router.replace({ query: {} })
  search()
}

async function loadSaved() {
  if (!currentUser.value) return
  try {
    const response = await axios.get(`${API_URL}/favourites/${currentUser.value._id}/ids`)
    savedIds.value = response.data
  } catch (error) {
    console.log(error.message)
  }
}

function isSaved(product) {
  return savedIds.value.includes(product._id)
}

async function toggleSave(product) {
  if (!currentUser.value) {
    router.push('/login')
    return
  }
  try {
    const response = await axios.post(`${API_URL}/favourites`, {
      user: currentUser.value._id,
      product: product._id,
    })
    if (response.data.saved) savedIds.value.push(product._id)
    else savedIds.value = savedIds.value.filter((id) => id !== product._id)
  } catch (error) {
    console.log(error.message)
  }
}

onMounted(() => {
  search()
  loadSaved()
})
</script>

<template>
  <div>
    <div class="d-flex justify-content-between align-items-center mb-3">
      <h2 class="page-title">Browse</h2>
      <ViewToggle />
    </div>

    <!-- the Filters panel slides open leftwards from its button and the search bar shrinks to make room -->
    <div class="search-toolbar mb-4">
      <div class="search-input-wrapper">
        <input type="text" class="form-control" placeholder="Search products..." aria-label="Search products"
          v-model.trim="q" @input="search" @keyup.enter="submitSearch" />
      </div>
      <div class="search-button-wrapper">
        <button type="button" class="btn btn-brand w-100" @click="submitSearch">Search</button>
      </div>

      <div id="browse-filters" class="filters-panel" :class="{ open: filtersOpen }" :inert="!filtersOpen">
        <div class="filters-body">
          <select class="form-select filter-category" v-model="category" aria-label="Category" @change="search">
            <option value="">All categories</option>
            <option v-for="c in CATEGORIES" :key="c" :value="c">{{ c }}</option>
          </select>
          <input type="number" min="0" class="form-control filter-price" placeholder="Max $" aria-label="Max price"
            v-model.number="maxPrice" @change="search" />
          <select class="form-select filter-sort" v-model="sort" aria-label="Sort by">
            <option v-for="o in SORTS" :key="o.value" :value="o.value">{{ o.label }}</option>
          </select>
          <button type="button" class="btn btn-outline-secondary filter-reset" :disabled="!hasChanges" @click="resetAll">Reset</button>
        </div>
      </div>

      <button type="button" class="btn filters-btn" :class="{ open: filtersOpen }" aria-controls="browse-filters"
        :aria-expanded="filtersOpen" @click="filtersOpen = !filtersOpen">
        <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
          <path d="M6 10.5a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 0 1h-3a.5.5 0 0 1-.5-.5m-2-3a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 0 1h-7a.5.5 0 0 1-.5-.5m-2-3a.5.5 0 0 1 .5-.5h11a.5.5 0 0 1 0 1h-11a.5.5 0 0 1-.5-.5" />
        </svg>
        Filters
        <span v-if="activeFilters" class="filters-count" :aria-label="`${activeFilters} in use`">{{ activeFilters }}</span>
        <span class="chevron" aria-hidden="true">&#9666;</span>
      </button>
    </div>

    <PageSkeleton v-if="loading && products.length === 0" variant="grid" label="Loading products" />
    <p v-else-if="products.length === 0 && shops.length === 0" class="text-muted"> No products or shops found. </p>

    <div class="card-grid mb-4">
      <div v-for="p in sortedProducts" :key="p._id">
        <ProductCard :product="p" favourite />
      </div>
    </div>

    <div class="card-grid">
      <div v-for="s in shops" :key="s.owner">
        <ShopCard :shop="s">
          <button class="btn btn-sm" :class="{ 'btn-danger': isSaved(s), 'btn-outline-danger': !isSaved(s) }"
            @click="toggleSave(s)">
            ♥
          </button>
        </ShopCard>

      </div>
    </div>
  </div>
</template>

<style scoped>
.search-toolbar {
  display: flex;
  align-items: stretch;
  gap: 8px;
}
.search-input-wrapper {
  flex: 1 1 0;
  min-width: 0;
}
.search-button-wrapper {
  flex: 0 0 100px;
}
.search-toolbar .form-control,
.search-toolbar .btn {
  height: 42px;
}

.filters-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  flex-shrink: 0;
  border: 1px solid var(--line);
  background: var(--surface);
  color: var(--ink);
}
.filters-btn:hover,
.filters-btn.open {
  border-color: var(--ocean);
  background: var(--ocean-soft);
  color: var(--ocean-dark);
}
.filters-count {
  min-width: 20px;
  padding: 0 6px;
  border-radius: 999px;
  background: var(--ocean);
  color: #fff;
  font-size: 0.72rem;
  font-weight: 600;
  line-height: 20px;
}
.chevron {
  font-size: 0.75rem;
  transition: transform 0.25s ease;
}
.filters-btn.open .chevron {
  transform: rotate(180deg);
}
@media (max-width: 1199.98px) {
  .chevron { transform: rotate(-90deg); }
  .filters-btn.open .chevron { transform: rotate(90deg); }
}

/* slide open right -> left: the panel's width grows from 0 (its right edge stays by the button),
   so the search bar (flex: 1) gets shorter as it opens */
.filters-panel {
  display: flex;
  justify-content: flex-end; /* content is revealed from the right side first */
  flex: 0 0 auto;
  max-width: 0;
  margin-left: -8px; /* hide the toolbar gap while closed */
  overflow: hidden;
  opacity: 0;
  transition: max-width 0.35s ease, margin 0.35s ease, opacity 0.25s ease;
}
.filters-panel.open {
  max-width: 620px;
  margin-left: 0;
  opacity: 1;
}
.filters-body {
  display: flex;
  flex-shrink: 0;
  gap: 8px;
}
.filters-body .form-control,
.filters-body .form-select,
.filters-body .btn {
  height: 42px;
}
.filter-category { width: 160px; }
.filter-price { width: 100px; }
.filter-sort { width: 220px; }
.filter-reset { width: 90px; }
.search-input-wrapper {
  min-width: 160px; /* never squeezed to nothing */
}

/* narrower screens: no room in one row, so the panel drops below and slides down instead */
@media (max-width: 1199.98px) {
  .search-toolbar {
    flex-wrap: wrap;
  }
  .filters-panel {
    order: 1;
    flex-basis: 100%;
    max-width: none;
    max-height: 0;
    margin: -8px 0 0;
    transition: max-height 0.35s ease, margin 0.35s ease, opacity 0.25s ease;
  }
  .filters-panel.open {
    max-width: none;
    max-height: 220px;
    margin: 0;
  }
  .filters-body {
    flex: 1 1 auto;
    flex-wrap: wrap;
  }
  .filter-category,
  .filter-price,
  .filter-sort {
    flex: 1 1 140px;
    width: auto;
  }
}
@media (max-width: 575.98px) {
  .search-toolbar {
    flex-wrap: wrap;
  }
  .search-input-wrapper {
    flex-basis: 100%;
  }
  .search-button-wrapper {
    flex: 1 1 0;
  }
  .filter-category,
  .filter-price,
  .filter-sort,
  .filter-reset {
    flex-basis: 100%;
  }
}
@media (prefers-reduced-motion: reduce) {
  .filters-panel,
  .chevron {
    transition: none;
  }
}
</style>
