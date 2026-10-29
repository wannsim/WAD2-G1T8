<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import bootstrap from 'bootstrap/dist/js/bootstrap.bundle.min.js'

// Pop-up asking why an order is being declined / cancelled. The reason is shown to the other side.
//   <ReasonModal ref="reasonModal" />
//   const reason = await reasonModal.value.ask({ title: 'Cancel this order?', confirmLabel: 'Yes, cancel' })
//   -> the reason typed, or null if they closed the pop-up
const MAX_LENGTH = 300 // same limit as the server

const modalEl = ref(null)
const title = ref('')
const hint = ref('')
const confirmLabel = ref('')
const reason = ref('')
const touched = ref(false)
let modal = null
let resolveAsk = null

const missing = computed(() => reason.value.trim() === '')

function ask(options) {
  title.value = options.title
  hint.value = options.hint || ''
  confirmLabel.value = options.confirmLabel || 'Confirm'
  reason.value = ''
  touched.value = false
  modal.show()
  return new Promise((resolve) => (resolveAsk = resolve))
}
defineExpose({ ask })

function finish(value) {
  resolveAsk?.(value)
  resolveAsk = null
}

function confirm() {
  touched.value = true
  if (missing.value) return
  finish(reason.value.trim())
  modal.hide()
}

onMounted(() => {
  modal = new bootstrap.Modal(modalEl.value)
  modalEl.value.addEventListener('hidden.bs.modal', () => finish(null)) // closed without confirming
  modalEl.value.addEventListener('shown.bs.modal', () => modalEl.value.querySelector('textarea')?.focus())
})
onBeforeUnmount(() => {
  finish(null)
  modal?.dispose()
})
</script>

<template>
  <div class="modal fade" ref="modalEl" tabindex="-1" aria-labelledby="reason-modal-title">
    <div class="modal-dialog modal-dialog-centered">
      <form class="modal-content" @submit.prevent="confirm">
        <div class="modal-header">
          <h5 id="reason-modal-title" class="modal-title">{{ title }}</h5>
          <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
        </div>
        <div class="modal-body">
          <label for="reason-input" class="form-label">Reason <span class="text-danger">*</span></label>
          <textarea id="reason-input" v-model="reason" class="form-control" :class="{ 'is-invalid': touched && missing }"
            rows="3" :maxlength="MAX_LENGTH" placeholder="E.g. I am out of ingredients this week" data-testid="reason-input"></textarea>
          <div class="invalid-feedback">Please give a reason.</div>
          <div class="d-flex justify-content-between form-text">
            <span>{{ hint }}</span>
            <span>{{ reason.length }}/{{ MAX_LENGTH }}</span>
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal" data-testid="reason-cancel">Go back</button>
          <button type="submit" class="btn btn-danger" data-testid="reason-confirm">{{ confirmLabel }}</button>
        </div>
      </form>
    </div>
  </div>
</template>
