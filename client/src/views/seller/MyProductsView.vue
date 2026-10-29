<template>
  <div class="mb-5">
    <!-- Status Message Alert -->
    <div v-if="statusMessage.text" class="alert" :class="statusMessage.type === 'error' ? 'alert-danger' : 'alert-success'" role="alert">
      {{ statusMessage.text }}
    </div>

    <h2 class="page-title mb-1">Add products & services</h2>
    <p class="text-muted mb-4">Create a listing so buyers can discover your products.</p>

    <p v-if="loadingShop" class="text-muted">Loading...</p>

    <!-- no shop yet: the seller must set up their shop profile before they can list anything -->
    <div v-else-if="!myShopId" class="card p-4 shadow-sm text-center">
      <h5>Set up your shop profile first</h5>
      <p class="text-muted mb-3">You need a shop profile (shop name, location, etc.) before you can add products or services.</p>
      <div><RouterLink to="/profile" class="btn btn-brand">Set up my shop profile</RouterLink></div>
    </div>

    <div v-else class="card p-4 shadow-sm">
      <form @submit.prevent="submitItem">
        <ProductFields v-model="form" v-model:files="files" />
        <button type="submit" class="btn btn-success w-100 mt-2" :disabled="saving">{{ saving ? 'Creating...' : 'Create listing' }}</button>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import axios from 'axios'
import { currentUser } from '@/utils/auth'
import { API_URL } from '@/utils/config'
import { emptyProductForm, toProductFormData, isValidPrice } from '@/utils/productForm'
import ProductFields from '@/components/ProductFields.vue'

const form = ref(emptyProductForm())
const files = ref([])
const saving = ref(false)
const myShopId = ref('')
const loadingShop = ref(true)
const statusMessage = ref({ text: '', type: '' })

const displayStatus = (text, type) => {
  statusMessage.value = { text, type }
  window.scrollTo({ top: 0, behavior: 'smooth' })
  setTimeout(() => {
    statusMessage.value = { text: '', type: '' }
  }, 5000)
}

onMounted(async () => {
  try {
    if (!currentUser.value || !currentUser.value._id) return
    const res = await axios.get(`${API_URL}/shops/mine/${currentUser.value._id}`)
    if (res.data) myShopId.value = res.data._id
  } catch (error) {
    console.error("Could not fetch shop details", error)
  } finally {
    loadingShop.value = false
  }
})

const submitItem = async () => {
  if (!myShopId.value) {
    return displayStatus("Error: Could not find your shop ID. Please save your profile first.", "error")
  }
  if (files.value.length === 0) return displayStatus('Please add at least one photo.', 'error')
  if (!isValidPrice(form.value.price)) return displayStatus('Price must have at most 2 decimal places, e.g. 6.00', 'error')

  const formData = toProductFormData(form.value, files.value)
  formData.append('shopId', myShopId.value)
  formData.append('user', currentUser.value._id)

  saving.value = true
  try {
    await axios.post(`${API_URL}/products`, formData)
    displayStatus('Listing successful!', 'success')
    form.value = emptyProductForm()
    files.value = []
  } catch (error) {
    console.error("Upload error:", error)
    displayStatus(error.response?.data?.error || "Not successful, try again.", "error")
  } finally {
    saving.value = false
  }
}
</script>
