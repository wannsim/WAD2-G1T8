<template>
  <div class="mb-5" v-if="shop">
    <div class="p-4 bg-light rounded mb-4">
      <h2 class="page-title">{{ shop.name }}</h2>
      <p><strong>Location (nearest MRT):</strong> {{ shop.nearestMrt }}</p>
      <p><strong>Experience:</strong> {{ shop.experience }}</p>
      <div>
        <span class="badge bg-secondary me-1" v-for="cat in shop.categories" :key="cat">{{ cat }}</span>
      </div>
    </div>

    <h4>Products & services</h4>
    <div class="card-grid">
      <div v-for="item in products" :key="item._id">
        <div class="card h-100 shadow-sm">
          <!-- Renders just the first lightweight image preview -->
          <img v-if="item.images && item.images.length" :src="item.images[0]" class="card-img-top" style="height:150px; object-fit:cover;">
          <div class="card-body d-flex flex-column">
            <h6 class="card-title">{{ item.name }}</h6>
            <!-- Line 25 Fix: Uses item.category safely without calling .toUpperCase() on undefined -->
            <span class="badge bg-success mb-2" style="width: fit-content;">
              {{ capitalize(item.category || 'Others') }}
            </span>
            <p class="card-text mt-1 text-truncate">{{ item.description }}</p>
            <p class="fw-bold mb-2">${{ item.price }} / {{ item.unit || 'piece' }}</p>
            
            <button class="btn btn-outline-primary btn-sm mt-auto" @click="openEditModal(item)">Edit product / slots</button>
          </div>
        </div>
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
                <h6>Manage order slots</h6>
                <div v-for="(slot, index) in editingProduct.orderSlots" :key="index" class="row align-items-end mb-2">
                  <div class="col-md-6">
                    <label class="form-label small">Start time</label>
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
                <button type="button" class="btn btn-outline-secondary btn-sm mt-2" @click="addSlot">+ Add slot</button>
              </div>

              <div class="text-end">
                <button type="button" class="btn btn-secondary me-2" data-bs-dismiss="modal">Cancel</button>
                <button type="submit" class="btn btn-success">Save changes</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import axios from 'axios'
import { API_URL } from '@/utils/config'
import { capitalize } from '@/utils/format'
import { currentUser } from '@/utils/auth'
import bootstrap from 'bootstrap/dist/js/bootstrap.bundle.min.js'

const shop = ref(null)
const products = ref([])
const editingProduct = ref(null)
let editModalInstance = null

onMounted(async () => {
  try {
    if (!currentUser.value || !currentUser.value._id) return

    const res = await axios.get(`${API_URL}/shops/mine/${currentUser.value._id}`)
    
    if (res.data) {
      shop.value = res.data
      const prodRes = await axios.get(`${API_URL}/products/shop/${shop.value._id}`)
      products.value = prodRes.data
    }
  } catch (error) {
    console.error("Error loading shop data", error)
  }
})

const openEditModal = (item) => {
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

    const res = await axios.put(`${API_URL}/products/${editingProduct.value._id}`, formData)
    
    const index = products.value.findIndex(p => p._id === res.data._id)
    if (index !== -1) products.value[index] = res.data

    editModalInstance.hide()
  } catch (error) {
    console.error("Failed to update product:", error)
  }


}


onMounted(async () => {
  try {
    if (!currentUser.value || !currentUser.value._id) return

    const res = await axios.get(`${API_URL}/shops/mine/${currentUser.value._id}`)
    if (res.data) {
      shop.value = res.data
      // Temporarily bypass product fetching to see if the page loads instantly
      products.value = [] 
      console.log("Shop loaded successfully without products")
    }
  } catch (error) {
    console.error("Error loading shop data", error)
  }
})
</script>