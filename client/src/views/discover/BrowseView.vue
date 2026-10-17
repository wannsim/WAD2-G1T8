<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'
import { API_URL } from '@/utils/config'
import { currentUser } from '@/utils/auth'
import { CATEGORIES } from '@/utils/constants'
import ShopCard from '@/components/ShopCard.vue'

// Owner: Member 3 - browse, search, filter, favourite
const router = useRouter()
const q = ref('')
const category = ref('')
const maxPrice = ref('')
const products = ref([])
const shops = ref([])
const savedIds = ref([])

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
      <h2>Browse</h2>
      <RouterLink to="/map" class="btn btn-outline-secondary btn-sm">Switch to map</RouterLink>
    </div>

    <div class="row g-2 mb-4">
      <div class="col-md-5">
        <input type="text" class="form-control" placeholder="Search products..." v-model.trim="q" @input="search" />
      </div>
      <div class="col-md-3">
        <select class="form-select" v-model="category" @change="search">
          <option value="">All categories</option>
          <option v-for="c in CATEGORIES" :key="c">{{ c }}</option>
        </select>
      </div>
      <div class="col-md-2">
        <input type="number" min="0" class="form-control" placeholder="Max $" v-model.number="maxPrice"
          @change="search" />
      </div>
      <div class="col-md-2">
        <button class="btn btn-brand w-100" @click="search">Search</button>
      </div>
    </div>

    <!-- <p v-if="products.length === 0" class="text-muted">No products found.</p> -->
    <p v-if="products.length === 0 && shops.length === 0" class="text-muted"> No products or shops found. </p>

    <div class="row g-3">
      <div v-for="p in products" :key="p._id" class="col-sm-6 col-lg-3">
        <ProductCard :product="p">
          <button class="btn btn-sm" :class="{ 'btn-danger': isSaved(p), 'btn-outline-danger': !isSaved(p) }"
            @click="toggleSave(p)">
            ♥
          </button>
        </ProductCard>
      </div>
    </div>
    <!-- <div class="row g-3">
      <div v-for="s in shops" :key="s._id" class="col-sm-6 col-lg-3">
        <ShopCard :shop="s" />
      </div>
    </div> -->
    <div class="row g-3">
      <div v-for="s in shops" :key="s.owner" class="col-sm-6 col-lg-3">
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
