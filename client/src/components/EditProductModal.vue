<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import axios from 'axios'
import { API_URL } from '@/utils/config'
import bootstrap from 'bootstrap/dist/js/bootstrap.bundle.min.js'
import { productToForm, toProductFormData, isValidPrice } from '@/utils/productForm'
import ProductFields from '@/components/ProductFields.vue'

// Pop-up form for the shop owner to edit one listing. Used on My Shop and the shop page.
//   <EditProductModal ref="editModal" @saved="onSaved" />
//   editModal.value.open(product)      -> @saved gets the updated product
const emit = defineEmits(['saved'])

const modalEl = ref(null)
const editingProduct = ref(null) // form values, see utils/productForm.js
const currentImageUrl = ref('')
const photos = ref([])
const saving = ref(false)
const error = ref('')
let modal = null

function open(product) {
  error.value = ''
  photos.value = []
  currentImageUrl.value = product.imageUrl || ''
  editingProduct.value = productToForm(product)
  modal.show()
}
defineExpose({ open })

onMounted(() => {
  modal = new bootstrap.Modal(modalEl.value)
})
onBeforeUnmount(() => modal?.dispose())

async function save() {
  error.value = ''
  if (!isValidPrice(editingProduct.value.price)) {
    error.value = 'Price must have at most 2 decimal places, e.g. 6.00'
    return
  }
  saving.value = true
  try {
    // new photos replace the old ones; none chosen = keep the old ones
    const formData = toProductFormData(editingProduct.value, photos.value)
    const res = await axios.put(`${API_URL}/products/${editingProduct.value._id}`, formData)
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
  <!-- same fields as the "Add New Item / Service" form in MyProductsView (components/ProductFields.vue) -->
  <div class="modal fade" ref="modalEl" tabindex="-1">
    <div class="modal-dialog modal-xl modal-dialog-scrollable">
      <div class="modal-content">
        <template v-if="editingProduct">
          <div class="modal-header">
            <h5 class="modal-title">Edit item / service</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body p-4">
            <div v-if="error" class="alert alert-danger" role="alert">{{ error }}</div>

            <form @submit.prevent="save">
              <ProductFields v-model="editingProduct" v-model:files="photos" :current-image-url="currentImageUrl" />
              <button type="submit" class="btn btn-success w-100" :disabled="saving">{{ saving ? 'Saving...' : 'Save changes' }}</button>
            </form>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>
