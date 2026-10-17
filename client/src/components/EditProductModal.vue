<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import axios from 'axios'
import { API_URL } from '@/utils/config'
import bootstrap from 'bootstrap/dist/js/bootstrap.bundle.min.js'

// Pop-up form for the shop owner to edit one listing. Used on My Shop and the shop page.
//   <EditProductModal ref="editModal" @saved="onSaved" />
//   editModal.value.open(product)      -> @saved gets the updated product
const emit = defineEmits(['saved'])

const modalEl = ref(null)
const photoInput = ref(null)
const editingProduct = ref(null)
const photos = ref([])
const tagsInput = ref('')
const saving = ref(false)
const error = ref('')
let modal = null

// <input type="datetime-local"> wants local time "YYYY-MM-DDTHH:mm" (not UTC)
function toLocalInput(date) {
  if (!date) return ''
  const d = new Date(date)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function open(product) {
  error.value = ''
  photos.value = []
  if (photoInput.value) photoInput.value.value = ''
  tagsInput.value = (product.tags || []).join(', ')
  editingProduct.value = {
    ...JSON.parse(JSON.stringify(product)),
    orderSlots: (product.orderSlots || []).map((slot) => ({ ...slot, start: toLocalInput(slot.start) })),
  }
  modal.show()
}
defineExpose({ open })

onMounted(() => {
  modal = new bootstrap.Modal(modalEl.value)
})
onBeforeUnmount(() => modal?.dispose())

function onPhotosChange(event) {
  error.value = ''
  photos.value = [...event.target.files].slice(0, 5)
}

const addSlot = () => editingProduct.value.orderSlots.push({ start: '', capacity: 10 })
const removeSlot = (index) => editingProduct.value.orderSlots.splice(index, 1)

async function save() {
  error.value = ''
  saving.value = true
  try {
    const p = editingProduct.value
    const formData = new FormData()
    formData.append('name', p.name)
    formData.append('category', p.category || '')
    formData.append('description', p.description || '')
    formData.append('price', p.price)
    formData.append('unit', p.unit || 'piece')
    formData.append('customisable', p.customisable ?? false)
    formData.append('isAvailable', p.isAvailable ?? true)
    formData.append('tags', JSON.stringify(tagsInput.value.split(',').map((t) => t.trim()).filter(Boolean)))
    // local time from the input -> real date, so the time doesn't shift when saved
    const slots = p.orderSlots
      .filter((slot) => slot.start)
      .map((slot) => ({ ...slot, start: new Date(slot.start).toISOString() }))
    formData.append('orderSlots', JSON.stringify(slots))
    photos.value.forEach((file) => formData.append('images', file)) // new photos replace the old ones

    const res = await axios.put(`${API_URL}/products/${p._id}`, formData)
    emit('saved', res.data)
    modal.hide()
  } catch (err) {
    error.value = err.response?.data?.error || err.response?.data?.message || 'Could not save. Please try again.'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <!-- same layout and classes as the "Add New Item / Service" form in MyProductsView -->
  <div class="modal fade" ref="modalEl" tabindex="-1">
    <div class="modal-dialog modal-lg">
      <div class="modal-content">
        <template v-if="editingProduct">
          <div class="modal-header">
            <h5 class="modal-title">Edit Item / Service</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body p-4">
            <div v-if="error" class="alert alert-danger" role="alert">{{ error }}</div>

            <form @submit.prevent="save">
              <!-- Basic Info -->
              <div class="row mb-3">
                <div class="col-md-6">
                  <label class="form-label">Name</label>
                  <input type="text" class="form-control" v-model="editingProduct.name" required>
                </div>
                <div class="col-md-6">
                  <label class="form-label">Category</label>
                  <input type="text" class="form-control" v-model="editingProduct.category" placeholder="e.g. Handmade crafts" required>
                </div>
              </div>

              <div class="mb-3">
                <label class="form-label">Description</label>
                <textarea class="form-control" v-model="editingProduct.description" rows="2" placeholder="e.g. Pick your colours." required></textarea>
              </div>

              <div class="row mb-3">
                <div class="col-md-6">
                  <label class="form-label">Price ($)</label>
                  <input type="number" class="form-control" v-model="editingProduct.price" min="0" step="0.01" required>
                </div>
                <div class="col-md-6">
                  <label class="form-label">Unit</label>
                  <input type="text" class="form-control" v-model="editingProduct.unit" placeholder="e.g. piece, box" required>
                </div>
              </div>

              <div class="mb-3">
                <label class="form-label">Tags (Comma-separated)</label>
                <input type="text" class="form-control" v-model="tagsInput" placeholder="e.g. keychain, gift, beaded">
              </div>

              <!-- Checkboxes -->
              <div class="row mb-3">
                <div class="col-md-6 form-check">
                  <input type="checkbox" class="form-check-input" id="editCustomisable" v-model="editingProduct.customisable">
                  <label class="form-check-label" for="editCustomisable">Customisable</label>
                </div>
                <div class="col-md-6 form-check">
                  <input type="checkbox" class="form-check-input" id="editIsAvailable" v-model="editingProduct.isAvailable">
                  <label class="form-check-label" for="editIsAvailable">Is Available</label>
                </div>
              </div>

              <!-- Order Slots Section -->
              <div class="card p-3 mb-3 bg-light">
                <h6>Order Slots</h6>
                <div v-for="(slot, index) in editingProduct.orderSlots" :key="index" class="row align-items-end mb-2">
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
                <div class="d-flex align-items-center gap-3 mb-2">
                  <img :src="editingProduct.imageUrl || '/placeholder.svg'" :alt="editingProduct.name" class="rounded border"
                    style="width: 80px; height: 80px; object-fit: cover;" @error="$event.target.src = '/placeholder.svg'">
                  <span class="small text-muted">Current photo. New images replace the current ones; leave empty to keep them.</span>
                </div>
                <input type="file" class="form-control" multiple accept="image/*" ref="photoInput" @change="onPhotosChange">
                <ul v-if="photos.length > 0" class="mt-2 small text-muted">
                  <li v-for="(file, index) in photos" :key="index">{{ file.name }}</li>
                </ul>
              </div>

              <button type="submit" class="btn btn-success w-100" :disabled="saving">{{ saving ? 'Saving...' : 'Save Changes' }}</button>
            </form>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>
