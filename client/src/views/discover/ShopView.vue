<template>
  <p v-if="loading" class="container mt-4 text-muted">Loading shop...</p>
  <div v-else-if="loadError" class="container mt-4 alert alert-warning">
    {{ loadError }} <RouterLink to="/browse">Back to browse</RouterLink>
  </div>

  <div class="container mt-4 mb-5" v-else-if="shop">
    <div class="p-4 bg-light rounded mb-4">
      <div class="d-flex justify-content-between align-items-start flex-wrap gap-2">
        <h2 class="mb-1">{{ shop.name }}</h2>
        <FollowButton :shop="shop" :followerCountTF="true"/>
      </div>
      <p v-if="shop.description" class="text-muted">{{ shop.description }}</p>
      <p v-if="shop.nearestMrt"><strong>📍 Location (Nearest MRT):</strong> {{ shop.nearestMrt }}</p>
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

    <h4>Products & Services <span class="text-muted fs-6">({{ products.length }})</span></h4>
    <p v-if="products.length === 0" class="text-muted">This shop has no listings yet.</p>
    <div class="row g-3">
      <div class="col-sm-6 col-lg-3" v-for="item in sortedProducts" :key="item._id">
        <ProductCard :product="item">
          <span v-if="isPinned(item)" class="small">📌 Pinned</span>
          <!-- only the shop owner can edit -->
          <button v-if="isOwner" class="btn btn-outline-primary btn-sm" @click="openEditModal(item)">Edit</button>
        </ProductCard>
      </div>
    </div>

    <!-- Edit Modal -->
    <div class="modal fade" id="editProductModal" tabindex="-1">
      <div class="modal-dialog modal-lg">
        <div class="modal-content" v-if="editingProduct">
          <div class="modal-header">
            <h5 class="modal-title">Edit Product: {{ editingProduct.name }}</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            <form @submit.prevent="updateProduct">
              <div class="mb-3">
                <label class="form-label">Name</label>
                <input type="text" class="form-control" v-model="editingProduct.name" required>
              </div>

              <div class="mb-3">
                <label class="form-label">Description</label>
                <textarea class="form-control" v-model="editingProduct.description" rows="2" required></textarea>
              </div>

              <div class="row mb-3">
                <div class="col-md-6">
                  <label class="form-label">Price ($)</label>
                  <input type="number" class="form-control" v-model="editingProduct.price" min="0" step="0.01" required>
                </div>
                <div class="col-md-6">
                  <label class="form-label">Category</label>
                  <input type="text" class="form-control" v-model="editingProduct.category" required>
                </div>
              </div>

              <!-- Order Slots Section -->
              <div class="card p-3 mb-3 bg-light">
                <h6>Manage Order Slots</h6>
                <div v-for="(slot, index) in editingProduct.orderSlots" :key="index" class="row align-items-end mb-2">
                  <div class="col-md-6">
                    <label class="form-label small">Start Time</label>
                    <input type="datetime-local" class="form-control" v-model="slot.start" required>
                  </div>
                  <div class="col-md-4">
                    <label class="form-label small">Capacity</label>
                    <input type="number" class="form-control" v-model="slot.capacity" min="1" required>
                  </div>
                  <div class="col-md-2">
                    <button type="button" class="btn btn-outline-danger btn-sm w-100" @click="removeSlot(index)">X</button>
                  </div>
                </div>
                <button type="button" class="btn btn-outline-secondary btn-sm mt-2" @click="addSlot">+ Add Slot</button>
              </div>

              <div class="text-end">
                <button type="button" class="btn btn-secondary me-2" data-bs-dismiss="modal">Cancel</button>
                <button type="submit" class="btn btn-success">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
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
import bootstrap from 'bootstrap/dist/js/bootstrap.bundle.min.js'

const shop = ref(null)
const products = ref([])
const editingProduct = ref(null)
let editModalInstance = null

// Owner: Member 3 - /shops/:id  the public page of one shop (buyers land here from a product page)
const route = useRoute()
const loading = ref(true)
const loadError = ref('')

const isOwner = computed(() => !!shop.value && !!currentUser.value && String(shop.value.owner) === currentUser.value._id)
const isPinned = (item) => !!shop.value && String(shop.value.pinnedProduct) === item._id
// pinned product first, the rest stay newest first
const sortedProducts = computed(() => [...products.value].sort((a, b) => isPinned(b) - isPinned(a)))
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
})

const openEditModal = (item) => {
  // Format dates for datetime-local input fields (YYYY-MM-DDTHH:mm)
  editingProduct.value = JSON.parse(JSON.stringify(item))
  if (editingProduct.value.orderSlots) {
    editingProduct.value.orderSlots = editingProduct.value.orderSlots.map(slot => ({
      ...slot,
      start: slot.start ? slot.start.slice(0, 16) : ''
    }))
  }
  
  const modalElement = document.getElementById('editProductModal')
  editModalInstance = new bootstrap.Modal(modalElement)
  editModalInstance.show()
}

const addSlot = () => {
  editingProduct.value.orderSlots.push({ start: '', capacity: 10 })
}

const removeSlot = (index) => {
  editingProduct.value.orderSlots.splice(index, 1)
}

const updateProduct = async () => {
  try {
    const formData = new FormData()
    formData.append('name', editingProduct.value.name)
    formData.append('category', editingProduct.value.category)
    formData.append('description', editingProduct.value.description)
    formData.append('price', editingProduct.value.price)
    formData.append('unit', editingProduct.value.unit || 'piece')
    formData.append('customisable', editingProduct.value.customisable ?? true)
    formData.append('isAvailable', editingProduct.value.isAvailable ?? true)
    formData.append('orderSlots', JSON.stringify(editingProduct.value.orderSlots))

    const res = await axios.put(`http://localhost:8000/api/products/${editingProduct.value._id}`, formData)
    
    // Update local list
    const index = products.value.findIndex(p => p._id === res.data._id)
    if (index !== -1) products.value[index] = res.data

    editModalInstance.hide()
  } catch (error) {
    console.error("Failed to update product:", error)
  }
}
</script>