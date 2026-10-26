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
const products = ref([])
const shops = ref([])
const savedIds = ref([])
const mapRoute = computed(() => currentUser.value?.preferredMrt
  ? { path: '/map', query: { mrt: currentUser.value.preferredMrt } }
  : '/map')

async function search() {
  try {
    const response = await axios.get(`${API_URL}/discover`, {
      params: { q: q.value, category: category.value, maxPrice: maxPrice.value },
    })
    console.log('Products:', response.data.products)
    console.log('Shops:', response.data.shops)
    products.value = response.data.products
    shops.value = response.data.shops

  } catch (error) {
    console.log(error.message)
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

// TODO (Member 3): sorting, radius filter, distance display, list/map toggle state
</script>

<template>
  <div>
    <div class="d-flex justify-content-between align-items-center mb-3">
      <h2 class="page-title">Browse</h2>
      <ViewToggle />
    </div>

    <div class="search-toolbar mb-4">

  <!-- Row 1: Search bar -->
  <div class="search-input-wrapper">
    <input
      type="text"
      class="form-control rounded-end-0"
      placeholder="Search products..."
      v-model.trim="q"
      @input="search"
      @keyup.enter="submitSearch"
    />
  </div>

  <!-- Row 2: Search button -->
  <div class="search-button-wrapper">
    <button
      class="btn btn-brand w-100 rounded-start-0"
      @click="submitSearch"
    >
      Search
    </button>
  </div>

  <!-- Row 3: Both filters -->
  <div class="filter-wrapper">
    <select class="form-select" v-model="category" @change="search">
      <option value="">All categories</option>
      <option v-for="c in CATEGORIES" :key="c" :value="c">
        {{ c }}
      </option>
    </select>
  </div>

  <div class="filter-wrapper">
    <input
      type="number"
      min="0"
      class="form-control"
      placeholder="Max $"
      v-model.number="maxPrice"
      @change="search"
    />
  </div>


</div>

    <p v-if="products.length === 0 && shops.length === 0" class="text-muted"> No products or shops found. </p>

    <div class="card-grid mb-4">
      <div v-for="p in products" :key="p._id">
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
  flex-wrap: nowrap;
  align-items: stretch;
  gap: 8px;
  width: 100%;
}

.search-input-wrapper {
  flex: 1 1 0;
  min-width: 0;
}

.search-button-wrapper {
  flex: 0 0 100px;
  width: 100px;
}

.filter-wrapper {
  flex: 0 0 16.666667%;
  min-width: 0;
}

.search-toolbar .form-control,
.search-toolbar .form-select,
.search-toolbar .btn {
  height: 38px;
}

/* Small screens and mobile: below 576px */
@media (max-width: 575.98px) {
  .search-toolbar {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }

  .search-input-wrapper {
    grid-column: 1 / -1;
  }

  .search-button-wrapper {
    grid-column: 1 / -1;
    width: 100%;
  }

  .filter-wrapper {
    grid-column: span 1;
    width: 100%;
  }

  /* Remove rounded corners on mobile */
  .search-input-wrapper .form-control,
  .search-button-wrapper .btn {
    border-radius: 0.375rem !important;
  }
}

/* At 576px and above: connect the search input and button */
@media (min-width: 576px) {
  .search-toolbar {
    column-gap: 8px;
  }

  .search-input-wrapper {
    margin-right: -8px;
  }

  .search-input-wrapper .form-control {
    border-top-right-radius: 0;
    border-bottom-right-radius: 0;
  }

  .search-button-wrapper .btn {
    border-top-left-radius: 0;
    border-bottom-left-radius: 0;
  }
}
</style>
