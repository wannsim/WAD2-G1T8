<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import axios from 'axios'
import { API_URL } from '@/utils/config'
import { currentUser } from '@/utils/auth'
import { CATEGORIES } from '@/utils/constants'
import { formatDateTime } from '@/utils/format'

// Owner: Cheyenne - add a product (/seller/products/new) or edit one (/seller/products/:id/edit)
const route = useRoute()
const router = useRouter()
const productId = route.params.id // undefined when adding a new product
const shopId = ref(null)
const error = ref('')

const product = ref({
  name: '',
  category: '',
  description: '',
  price: 0,
  unit: 'piece',
  imageUrl: '',
  customisable: false,
  isAvailable: true,
  orderSlots: [],
})

const newSlotTime = ref('')
const newSlotCapacity = ref(1)

onMounted(async () => {
  if (!currentUser.value || currentUser.value.role !== 'seller') {
    router.push('/login')
    return
  }
  try {
    const shopResponse = await axios.get(`${API_URL}/shops/mine/${currentUser.value._id}`)
    if (!shopResponse.data) {
      router.push('/seller/shop')
      return
    }
    shopId.value = shopResponse.data._id

    if (productId) {
      const response = await axios.get(`${API_URL}/products/${productId}`)
      product.value = { ...product.value, ...response.data }
      product.value.shop = shopId.value // populate() gave an object; we only want the id when saving
    }
  } catch (err) {
    error.value = err.message
  }
})

function addSlot() {
  if (!newSlotTime.value) return
  product.value.orderSlots.push({ start: newSlotTime.value, capacity: newSlotCapacity.value })
  newSlotTime.value = ''
}

function removeSlot(index) {
  product.value.orderSlots.splice(index, 1)
}

async function save() {
  error.value = ''
  try {
    if (productId) {
      await axios.put(`${API_URL}/products/${productId}`, product.value)
    } else {
      await axios.post(`${API_URL}/products`, { ...product.value, shop: shopId.value })
    }
    router.push('/seller/products')
  } catch (err) {
    error.value = err.response?.data?.message || err.message
  }
}
</script>

<template>
  <div class="row justify-content-center">
    <div class="col-md-7">
      <h2 class="mb-3">{{ productId ? 'Edit product' : 'Add product' }}</h2>
      <div v-if="error" class="alert alert-danger">{{ error }}</div>

      <div class="mb-3">
        <label class="form-label">Name</label>
        <input type="text" class="form-control" v-model.trim="product.name" />
      </div>
      <div class="row">
        <div class="col-md-6 mb-3">
          <label class="form-label">Category</label>
          <select class="form-select" v-model="product.category">
            <option disabled value="">Please select one</option>
            <option v-for="c in CATEGORIES" :key="c">{{ c }}</option>
          </select>
        </div>
        <div class="col-md-3 mb-3">
          <label class="form-label">Price ($)</label>
          <input type="number" min="0" step="0.5" class="form-control" v-model.number="product.price" />
        </div>
        <div class="col-md-3 mb-3">
          <label class="form-label">Unit</label>
          <input type="text" class="form-control" v-model.trim="product.unit" />
        </div>
      </div>
      <div class="mb-3">
        <label class="form-label">Description</label>
        <textarea class="form-control" rows="3" v-model="product.description"></textarea>
      </div>
      <div class="mb-3">
        <label class="form-label">Photo URL (optional)</label>
        <input type="text" class="form-control" v-model.trim="product.imageUrl" />
      </div>

      <div class="form-check">
        <input class="form-check-input" type="checkbox" id="customisable" v-model="product.customisable" />
        <label class="form-check-label" for="customisable">Buyers can request customisation</label>
      </div>
      <div class="form-check mb-3">
        <input class="form-check-input" type="checkbox" id="available" v-model="product.isAvailable" />
        <label class="form-check-label" for="available">Available for ordering</label>
      </div>

      <h5>Order slots</h5>
      <div class="input-group mb-2">
        <input type="datetime-local" class="form-control" v-model="newSlotTime" />
        <input type="number" min="1" class="form-control" style="max-width: 90px" v-model.number="newSlotCapacity" />
        <button class="btn btn-outline-secondary" @click="addSlot">Add slot</button>
      </div>
      <ul class="list-group mb-3">
        <li v-for="(slot, index) in product.orderSlots" :key="index" class="list-group-item d-flex justify-content-between">
          <span>{{ formatDateTime(slot.start) }} (up to {{ slot.capacity }} orders)</span>
          <button class="btn btn-sm btn-outline-danger" @click="removeSlot(index)">Remove</button>
        </li>
      </ul>

      <button class="btn btn-brand" @click="save">Save product</button>
    </div>
  </div>
</template>
