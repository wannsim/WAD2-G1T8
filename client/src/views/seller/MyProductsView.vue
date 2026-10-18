<template>
  <div class="container mt-4 mb-5">
    <!-- Status Message Alert -->
    <div v-if="statusMessage.text" class="alert" :class="statusMessage.type === 'error' ? 'alert-danger' : 'alert-success'" role="alert">
      {{ statusMessage.text }}
    </div>

    <h3>Add Products & Services</h3>
    
    <div class="card p-4 shadow-sm">
      <h5>Add New Item / Service</h5>
      <form @submit.prevent="submitItem">
        
        <!-- Basic Info -->
        <div class="row mb-3">
          <div class="col-md-6">
            <label class="form-label">Name</label>
            <input type="text" class="form-control" v-model="form.name" required>
          </div>
          <div class="col-md-6">
            <label class="form-label">Category</label>
            <input type="text" class="form-control" v-model="form.category" placeholder="e.g. Handmade crafts" required>
          </div>
        </div>

        <div class="mb-3">
          <label class="form-label">Description</label>
          <textarea class="form-control" v-model="form.description" rows="2" placeholder="e.g. Pick your colours." required></textarea>
        </div>

        <div class="row mb-3">
          <div class="col-md-6">
            <label class="form-label">Price ($)</label>
            <input type="number" class="form-control" v-model="form.price" min="0" step="0.01" required>
          </div>
          <div class="col-md-6">
            <label class="form-label">Unit</label>
            <input type="text" class="form-control" v-model="form.unit" placeholder="e.g. piece, box" required>
          </div>
        </div>

        <div class="mb-3">
          <label class="form-label">Tags (Comma-separated)</label>
          <input type="text" class="form-control" v-model="tagsInput" placeholder="e.g. keychain, gift, beaded">
        </div>

        <!-- Checkboxes -->
        <div class="row mb-3">
          <div class="col-md-6 form-check">
            <input type="checkbox" class="form-check-input" id="customisable" v-model="form.customisable">
            <label class="form-check-label" for="customisable">Customisable</label>
          </div>
          <div class="col-md-6 form-check">
            <input type="checkbox" class="form-check-input" id="isAvailable" v-model="form.isAvailable">
            <label class="form-check-label" for="isAvailable">Is Available</label>
          </div>
        </div>

        <!-- Order Slots Section -->
        <div class="card p-3 mb-3 bg-light">
          <h6>Order Slots</h6>
          <div v-for="(slot, index) in orderSlots" :key="index" class="row align-items-end mb-2">
            <div class="col-md-6">
              <label class="form-label small">Start Date & Time</label>
              <input type="datetime-local" class="form-control" v-model="slot.start" required>
            </div>
            <div class="col-md-4">
              <label class="form-label small">Capacity</label>
              <input type="number" class="form-control" v-model="slot.capacity" min="1" required>
            </div>
            <div class="col-md-2">
              <button type="button" class="btn btn-outline-danger btn-sm w-100" @click="removeSlot(index)">Remove</button>
            </div>
          </div>
          <button type="button" class="btn btn-outline-primary btn-sm mt-2" @click="addSlot">+ Add Order Slot</button>
        </div>

        <!-- Multiple Image Upload -->
        <div class="mb-4">
          <label class="form-label">Upload Images (Max 5)</label>
          <input type="file" class="form-control" multiple @change="handleFiles" accept="image/*">
          <ul v-if="files.length > 0" class="mt-2 small text-muted">
            <li v-for="(file, index) in files" :key="index">{{ file.name }}</li>
          </ul>
        </div>

        <button type="submit" class="btn btn-success w-100">Create Listing</button>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import axios from 'axios'
import { currentUser } from '@/utils/auth'

const form = ref({
  name: '',
  category: '',
  description: '',
  price: 6,
  unit: 'piece',
  customisable: true,
  isAvailable: true
})

const tagsInput = ref('')
const orderSlots = ref([{ start: '', capacity: 10 }])
const files = ref([])
const myShopId = ref('')
const statusMessage = ref({ text: '', type: '' }) 

const displayStatus = (text, type) => {
  statusMessage.value = { text, type }
  setTimeout(() => {
    statusMessage.value = { text: '', type: '' }
  }, 5000)
}

onMounted(async () => {
  try {
    if (!currentUser.value || !currentUser.value._id) return
    const res = await axios.get(`http://localhost:8000/api/shops/mine/${currentUser.value._id}`)
    if (res.data) myShopId.value = res.data._id
  } catch (error) {
    console.error("Could not fetch shop details", error)
  }
})

const addSlot = () => {
  orderSlots.value.push({ start: '', capacity: 10 })
}

const removeSlot = (index) => {
  orderSlots.value.splice(index, 1)
}

const handleFiles = (e) => {
  const newFiles = Array.from(e.target.files)
  files.value = [...files.value, ...newFiles].slice(0, 5)
}

const submitItem = async () => {
  if (!myShopId.value) {
    return displayStatus("Error: Could not find your shop ID. Please save your profile first.", "error")
  }

  const formData = new FormData()
  formData.append('shopId', myShopId.value)
  formData.append('name', form.value.name)
  formData.append('category', form.value.category)
  formData.append('description', form.value.description)
  formData.append('price', form.value.price)
  formData.append('unit', form.value.unit)
  formData.append('customisable', form.value.customisable)
  formData.append('isAvailable', form.value.isAvailable)
  
  // Format tags and slots into JSON strings for backend parsing
  const tagsArray = tagsInput.value.split(',').map(s => s.trim()).filter(Boolean)
  formData.append('tags', JSON.stringify(tagsArray))
  formData.append('orderSlots', JSON.stringify(orderSlots.value))
  
  files.value.forEach(file => formData.append('images', file))

  try {
    await axios.post('http://localhost:8000/api/products', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
    
    displayStatus('Listing successful!', 'success')
    
    // Reset form
    form.value = { name: '', category: '', description: '', price: 0, unit: 'piece', customisable: false, isAvailable: true }
    tagsInput.value = ''
    orderSlots.value = [{ start: '', capacity: 10 }]
    files.value = []
    
    const fileInput = document.querySelector('input[type="file"]')
    if (fileInput) fileInput.value = ''

  } catch (error) {
    console.error("Upload error:", error)
    displayStatus("Not successful, try again.", "error")
  }
}
</script>