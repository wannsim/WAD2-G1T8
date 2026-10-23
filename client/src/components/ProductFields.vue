<script setup>
import { computed, onBeforeUnmount, ref, useId, watch } from 'vue'
import { CATEGORIES, UNITS } from '@/utils/constants'

// The input boxes of a product listing. Used by "Add Products & Services" (MyProductsView)
// and the Edit pop-up (EditProductModal), so both forms look and check the same.
//   <ProductFields v-model="form" v-model:files="files" :current-image-url="..." />
//   form = { name, category, description, price, unit, tagsInput, customisable, isAvailable, orderSlots: [{ start, capacity }] }
const form = defineModel({ required: true })
const files = defineModel('files', { default: () => [] })
const props = defineProps({
  currentImageUrl: { type: String, default: '' }, // edit only: the photo already saved
})

const id = useId() // unique ids for the labels, in case two forms are on one page
const MAX_PHOTOS = 5

// ---- price: numbers with at most 2 decimal places, shown as 6.00 ----
const priceError = computed(() => {
  const price = String(form.value.price ?? '').trim()
  if (price === '') return ''
  return /^\d+(\.\d{1,2})?$/.test(price) ? '' : 'Use at most 2 decimal places, e.g. 6.00'
})
function formatPrice() {
  if (form.value.price === '' || priceError.value) return
  form.value.price = Number(form.value.price).toFixed(2)
}

// ---- photos (required): preview the new ones ----
const fileInput = ref(null)
const previews = ref([])
watch(files, (list) => {
  previews.value.forEach(URL.revokeObjectURL)
  previews.value = list.map((file) => URL.createObjectURL(file))
}, { immediate: true })
onBeforeUnmount(() => previews.value.forEach(URL.revokeObjectURL))

function onFilesChange(event) {
  files.value = [...files.value, ...event.target.files].slice(0, MAX_PHOTOS)
  fileInput.value.value = '' // the chosen photos are kept in `files` (shown below), so more can be added
}
const removeFile = (index) => (files.value = files.value.filter((_, i) => i !== index))
const needsPhoto = computed(() => !props.currentImageUrl && files.value.length === 0)

// ---- order slots ----
const addSlot = () => form.value.orderSlots.push({ start: '', capacity: 10 })
const removeSlot = (index) => form.value.orderSlots.splice(index, 1)
</script>

<template>
  <p class="small text-muted mb-2"><span class="text-danger">*</span> Required</p>

  <div class="row g-3 mb-3">
    <div class="col-md-5">
      <label class="form-label" :for="`${id}-name`">Name <span class="text-danger">*</span></label>
      <input :id="`${id}-name`" type="text" class="form-control" v-model.trim="form.name" maxlength="80" required>
    </div>
    <div class="col-md-3">
      <label class="form-label" :for="`${id}-category`">Category <span class="text-danger">*</span></label>
      <select :id="`${id}-category`" class="form-select" v-model="form.category" required>
        <option disabled value="">Choose...</option>
        <option v-for="c in CATEGORIES" :key="c" :value="c">{{ c }}</option>
      </select>
    </div>
    <div class="col-6 col-md-2">
      <label class="form-label" :for="`${id}-price`">Price <span class="text-danger">*</span></label>
      <div class="input-group has-validation">
        <span class="input-group-text">$</span>
        <input :id="`${id}-price`" type="number" class="form-control" :class="{ 'is-invalid': priceError }"
          v-model="form.price" min="0" step="0.01" placeholder="0.00" required @blur="formatPrice">
        <div class="invalid-feedback">{{ priceError }}</div>
      </div>
    </div>
    <div class="col-6 col-md-2">
      <label class="form-label" :for="`${id}-unit`">Per <span class="text-danger">*</span></label>
      <select :id="`${id}-unit`" class="form-select" v-model="form.unit" required>
        <option disabled value="">Unit...</option>
        <option v-for="u in UNITS" :key="u" :value="u">{{ u }}</option>
      </select>
    </div>
  </div>

  <div class="row g-3 mb-3">
    <div class="col-md-7">
      <label class="form-label" :for="`${id}-description`">Description <span class="text-danger">*</span></label>
      <textarea :id="`${id}-description`" class="form-control mb-3" v-model="form.description" rows="3"
        placeholder="E.g. pick your colours" required></textarea>

      <label class="form-label" :for="`${id}-tags`">Tags <span class="text-muted small">(optional, recommended)</span></label>
      <input :id="`${id}-tags`" type="text" class="form-control" v-model="form.tagsInput" placeholder="E.g. keychain, gift, beaded">
      <div class="form-text">Separate with commas. Tags are used in search, so good tags help buyers find your item.</div>
    </div>

    <div class="col-md-5">
      <label class="form-label" :for="`${id}-photos`">
        Photos <span class="text-danger">*</span> <span class="text-muted small">(up to {{ MAX_PHOTOS }})</span>
      </label>
      <input :id="`${id}-photos`" ref="fileInput" type="file" class="form-control" multiple accept="image/*"
        :required="needsPhoto" :disabled="files.length >= MAX_PHOTOS" @change="onFilesChange">
      <div class="d-flex flex-wrap gap-2 mt-2">
        <div v-for="(src, index) in previews" :key="src" class="photo-thumb">
          <img :src="src" :alt="files[index]?.name">
          <button type="button" class="btn-close btn-close-white" aria-label="Remove photo" @click="removeFile(index)"></button>
        </div>
        <template v-if="previews.length === 0 && currentImageUrl">
          <img :src="currentImageUrl" alt="Current photo" class="photo-thumb" @error="$event.target.src = '/placeholder.svg'">
          <span class="small text-muted align-self-center">Current photo. New photos replace it.</span>
        </template>
      </div>

      <div class="form-check mt-3">
        <input :id="`${id}-customisable`" type="checkbox" class="form-check-input" v-model="form.customisable">
        <label class="form-check-label" :for="`${id}-customisable`">Buyers can request customisation</label>
      </div>
      <div class="form-check">
        <input :id="`${id}-available`" type="checkbox" class="form-check-input" v-model="form.isAvailable">
        <label class="form-check-label" :for="`${id}-available`">Available for ordering</label>
      </div>
    </div>
  </div>

  <div class="border rounded bg-light p-3 mb-3">
    <div class="d-flex justify-content-between align-items-center mb-2">
      <div>
        <h6 class="mb-0">Order slots</h6>
        <span class="small text-muted">Buyers choose one of these times when they order.</span>
      </div>
      <button type="button" class="btn btn-outline-primary btn-sm" @click="addSlot">+ Add slot</button>
    </div>
    <div class="row g-2">
      <div v-for="(slot, index) in form.orderSlots" :key="index" class="col-lg-6">
        <div class="input-group input-group-sm">
          <input type="datetime-local" class="form-control" v-model="slot.start" aria-label="Slot start date and time" required>
          <span class="input-group-text">Max</span>
          <input type="number" class="form-control slot-capacity" v-model.number="slot.capacity" min="1" step="1"
            aria-label="Max orders in this slot" required>
          <button type="button" class="btn btn-outline-danger" aria-label="Remove slot" title="Remove slot" @click="removeSlot(index)">&times;</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.photo-thumb {
  position: relative;
  width: 64px;
  height: 64px;
  border-radius: 0.375rem;
  object-fit: cover;
}
.photo-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 0.375rem;
}
.photo-thumb .btn-close {
  position: absolute;
  top: 2px;
  right: 2px;
  padding: 0.2rem;
  background-color: rgba(0, 0, 0, 0.55);
  border-radius: 50%;
  font-size: 0.55rem;
}
.slot-capacity {
  max-width: 70px;
}
</style>
