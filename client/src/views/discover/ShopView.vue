<template>
  <p v-if="loading" class="text-muted">Loading shop...</p>
  <div v-else-if="loadError" class="alert alert-warning">
    {{ loadError }} <RouterLink to="/browse">Back to browse</RouterLink>
  </div>

  <div class="mb-5" v-else-if="shop">
    <div class="p-4 bg-light rounded mb-4">
      <div class="d-flex justify-content-between align-items-start flex-wrap gap-2">
        <h2 class="page-title mb-1">{{ shop.name }}</h2>
        <FollowButton :shop="shop" :followerCountTF="true"/>
      </div>
      <p v-if="shop.description" class="text-muted">{{ shop.description }}</p>
      <p v-if="shop.nearestMrt"><strong>Location (nearest MRT):</strong> {{ shop.nearestMrt }}</p>
      <p v-if="shop.experience"><strong>Experience:</strong> {{ shop.experience }}</p>
      <p v-if="shop.certifications && shop.certifications.length">
        <strong>Certifications:</strong> {{ shop.certifications.join(', ') }}
      </p>
      <div>
        <span class="badge bg-secondary me-1" v-for="cat in shop.categories" :key="cat">{{ cat }}</span>
      </div>

      <!-- certificate photos uploaded on the seller's profile page -->
      <div v-if="shop.certificationFiles && shop.certificationFiles.length" class="d-flex flex-wrap gap-2 mt-3">
        <a v-for="cert in shop.certificationFiles" :key="cert._id" :href="certImageUrl(cert)" target="_blank" :title="cert.name">
          <img :src="certImageUrl(cert)" :alt="cert.name" class="rounded border" style="height: 80px; width: 80px; object-fit: cover;"
            loading="lazy" decoding="async">
        </a>
      </div>
    </div>

    <h4>Products & services <span class="text-muted fs-6">({{ products.length }})</span></h4>
    <p v-if="products.length === 0" class="text-muted">This shop has no listings yet.</p>
    <p v-if="isOwner && products.length" class="small text-muted mb-2">Click the pin on a product to show it first (up to 3).</p>
    <p v-if="pinError" class="small text-danger">{{ pinError }}</p>
    <div class="card-grid">
      <div v-for="item in sortedProducts" :key="item._id">
        <ProductCard :product="item" :pinned="isPinned(item)" :pinnable="isOwner" :pin-busy="pinning" @toggle-pin="togglePin(item)">
          <!-- only the shop owner can edit -->
          <button v-if="isOwner" class="btn btn-outline-primary btn-sm" @click="openEditModal(item)">Edit</button>
        </ProductCard>
      </div>
    </div>

    <!-- only the shop owner can open this -->
    <EditProductModal v-if="isOwner" ref="editModal" @saved="onProductSaved" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import axios from 'axios'
import { API_URL } from '@/utils/config'
import { currentUser } from '@/utils/auth'
import ProductCard from '@/components/ProductCard.vue'
import FollowButton from '@/components/FollowButton.vue'
import EditProductModal from '@/components/EditProductModal.vue'

const shop = ref(null)
const products = ref([])

// Owner: Member 3 - /shops/:id  the public page of one shop (buyers land here from a product page)
const route = useRoute()
const loading = ref(true)
const loadError = ref('')

const isOwner = computed(() => !!shop.value && !!currentUser.value && String(shop.value.owner) === currentUser.value._id)
const pinnedIds = computed(() => (shop.value?.pinnedProducts || []).map(String))
const isPinned = (item) => pinnedIds.value.includes(item._id)
// pinned products first (in the order they were pinned), the rest stay newest first
const pinRank = (item) => (isPinned(item) ? pinnedIds.value.indexOf(item._id) : pinnedIds.value.length)
const sortedProducts = computed(() => [...products.value].sort((a, b) => pinRank(a) - pinRank(b)))

// shop owner: pin / unpin from the pin in the top right of each card
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
const certImageUrl =(cert) => `${API_URL}/shops/${shop.value._id}/certs/${cert._id}/image`

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
})

const editModal = ref(null)
const openEditModal = (item) => editModal.value.open(item)
const onProductSaved = (updated) => {
  const index = products.value.findIndex((p) => p._id === updated._id)
  if (index !== -1) products.value[index] = updated
}
</script>
