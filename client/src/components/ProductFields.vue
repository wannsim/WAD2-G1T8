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
const shownPhotos = computed(() => previews.value.length || (props.currentImageUrl ? 1 : 0))
const emptyTiles = computed(() => Math.max(0, MAX_PHOTOS - shownPhotos.value))

// ---- order slots ----
// bootstrap-icons paths (16x16)
const CALENDAR_ICON = 'M3.5 0a.5.5 0 0 1 .5.5V1h8V.5a.5.5 0 0 1 1 0V1h1a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V3a2 2 0 0 1 2-2h1V.5a.5.5 0 0 1 .5-.5M1 4v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V4z'
const CLOCK_ICON = 'M8 3.5a.5.5 0 0 0-1 0V9a.5.5 0 0 0 .252.434l3.5 2a.5.5 0 0 0 .496-.868L8 8.71zM8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16m7-8A7 7 0 1 1 1 8a7 7 0 0 1 14 0'
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
      <!-- hidden file input, opened by clicking an empty tile -->
      <input :id="`${id}-photos`" ref="fileInput" type="file" class="photo-input" multiple accept="image/*"
        :required="needsPhoto" :disabled="files.length >= MAX_PHOTOS" @change="onFilesChange">
      <div class="photo-grid">
        <div v-for="(src, index) in previews" :key="src" class="photo-tile">
          <img :src="src" :alt="files[index]?.name">
          <button type="button" class="btn-close btn-close-white" aria-label="Remove photo" @click="removeFile(index)"></button>
        </div>
        <div v-if="previews.length === 0 && currentImageUrl" class="photo-tile" title="Current photo. New photos replace it.">
          <img :src="currentImageUrl" alt="Current photo" @error="$event.target.src = '/placeholder.svg'">
        </div>
        <button v-for="n in emptyTiles" :key="`empty-${n}`" type="button" class="photo-tile photo-add"
          aria-label="Add photo" @click="fileInput.click()">+</button>
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

  <div class="slots-box p-3 mb-3">
    <div class="d-flex justify-content-between align-items-start mb-2">
      <div>
        <h6 class="mb-0">Order slots</h6>
        <span class="small text-muted">Buyers choose one of these times when they order.</span>
      </div>
      <button type="button" class="btn btn-sm add-slot-btn" @click="addSlot">+ Add slot</button>
    </div>
    <div class="d-flex flex-column gap-2">
      <div v-for="(slot, index) in form.orderSlots" :key="index" class="slot-row">
        <svg class="slot-icon" width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path :d="CALENDAR_ICON" /></svg>
        <input type="datetime-local" class="slot-time" v-model="slot.start" aria-label="Slot start date and time" required>
        <svg class="slot-icon" width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path :d="CLOCK_ICON" /></svg>
        <span class="slot-max">Max</span>
        <input type="number" class="slot-capacity" v-model.number="slot.capacity" min="1" step="1"
          aria-label="Max orders in this slot" required>
        <button type="button" class="slot-remove" aria-label="Remove slot" title="Remove slot" @click="removeSlot(index)">&times;</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ---- photos: a row of 5 square tiles, empty ones are dashed "+" buttons ---- */
.photo-input {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0; /* hidden, but still checked by the browser's "required" */
}
.photo-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 0.6rem;
}
.photo-tile {
  position: relative;
  aspect-ratio: 1;
  border-radius: 0.5rem;
  overflow: hidden;
}
.photo-tile img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.photo-tile .btn-close {
  position: absolute;
  top: 4px;
  right: 4px;
  padding: 0.2rem;
  background-color: rgba(0, 0, 0, 0.55);
  border-radius: 50%;
  font-size: 0.55rem;
}
.photo-add {
  border: 1.5px dashed var(--line);
  background: var(--surface);
  color: var(--muted);
  font-size: 1.6rem;
  font-weight: 300;
  line-height: 1;
}
.photo-add:hover {
  border-color: var(--aqua);
  color: var(--ocean);
  background: var(--surface-soft);
}

/* ---- order slots ---- */
.slots-box {
  border: 1px solid var(--line);
  border-radius: 0.75rem;
  background: var(--surface-soft);
}
.add-slot-btn {
  border: 1px solid var(--line);
  border-radius: 999px;
  background: var(--surface);
  color: var(--ink);
}
.add-slot-btn:hover {
  background: var(--surface-hover);
}
.slot-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  max-width: 470px;
  padding: 0.35rem 0.6rem;
  border: 1px solid var(--line);
  border-radius: 0.5rem;
  background: var(--surface);
}
.slot-icon {
  flex-shrink: 0;
  color: var(--ink-soft);
}
.slot-time {
  flex: 1;
  min-width: 0;
  border: 0;
  background: transparent;
  color: var(--ink);
  font-size: 0.9rem;
  outline: none;
}
.slot-time::-webkit-calendar-picker-indicator {
  opacity: 0.5; /* the calendar icon on the left already shows this is a date */
}
.slot-max {
  font-size: 0.9rem;
  color: var(--ink);
}
.slot-capacity {
  width: 48px;
  border: 0;
  background: transparent;
  color: var(--ink);
  font-size: 0.9rem;
  outline: none;
}
.slot-remove {
  border: 0;
  background: transparent;
  color: var(--rose);
  font-size: 1.1rem;
  line-height: 1;
  padding: 0 0.15rem;
}
</style>
