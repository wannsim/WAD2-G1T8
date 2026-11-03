<script setup>
import { ref, computed, onBeforeUnmount } from 'vue'
import axios from 'axios'
import bootstrap from 'bootstrap/dist/js/bootstrap.bundle.min.js'
import { API_URL } from '@/utils/config'
import { formatDateTime } from '@/utils/format'

// "Recurring slots" pop-up on My shop: drag across a Mon-Sun timetable to pick when collection slots
// open, choose how often they repeat (weekly / monthly / every N weeks) and for how long, then they are
// added to the chosen products in one go (POST /products/shop/:shopId/slots with starts: [...]).
//   <RecurringSlotsModal ref="recurring" :shop-id="shop._id" :products="products" @saved="loadProducts" />
//   recurring.value.open()
const props = defineProps({
  shopId: { type: String, required: true },
  products: { type: Array, default: () => [] },
})
const emit = defineEmits(['saved'])

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const FIRST_HOUR = 7
const LAST_HOUR = 21 // last row starts at 9 pm
const MAX_SLOTS = 400 // same limit as the server

// ---- the timetable: rows of times, a cell per day ----
const step = ref(60) // minutes per row: 60 or 30
const times = computed(() => {
  const list = []
  for (let mins = FIRST_HOUR * 60; mins <= LAST_HOUR * 60; mins += step.value) list.push(mins)
  return list
})
// hourly rows: "7 AM"; 30-min rows always show minutes: "7:00 AM", "7:30 AM"
const timeLabel = (mins) => {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  const minutes = step.value === 30 || m ? `:${String(m).padStart(2, '0')}` : ''
  return `${h % 12 || 12}${minutes} ${h < 12 ? 'AM' : 'PM'}`
}
// chosen cells, as "day-minutes", e.g. "5-600" = Saturday 10:00 am
const chosen = ref(new Set())
const cellKey = (day, mins) => `${day}-${mins}`
const isChosen = (day, mins) => chosen.value.has(cellKey(day, mins))
function setCell(key, on) {
  const next = new Set(chosen.value)
  if (on) next.add(key)
  else next.delete(key)
  chosen.value = next
}
function changeStep(minutes) {
  step.value = minutes
  chosen.value = new Set() // the rows changed, so start again
}

// ---- drag to paint: press on a cell, move over others; starting on a chosen cell clears instead ----
let dragging = false
let paintOn = true
function onPointerDown(event, day, mins) {
  event.preventDefault()
  dragging = true
  paintOn = !isChosen(day, mins)
  setCell(cellKey(day, mins), paintOn)
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', stopDrag, { once: true })
}
function onPointerMove(event) {
  if (!dragging) return
  // works for touch too: find whichever cell is under the finger / mouse
  const cell = document.elementFromPoint(event.clientX, event.clientY)?.closest('[data-cell]')
  if (cell) setCell(cell.dataset.cell, paintOn)
}
function stopDrag() {
  dragging = false
  window.removeEventListener('pointermove', onPointerMove)
}
onBeforeUnmount(stopDrag)

// ---- how often + for how long ----
const repeat = ref('weekly') // weekly | monthly | custom
const everyWeeks = ref(2)
const pad = (n) => String(n).padStart(2, '0')
const dateInput = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const addDays = (d, n) => { const copy = new Date(d); copy.setDate(copy.getDate() + n); return copy }
const today = new Date()
const fromDate = ref(dateInput(today))
const untilDate = ref(dateInput(addDays(today, 8 * 7))) // 8 weeks by default
const minDate = dateInput(today)
const maxDate = dateInput(addDays(today, 366))

// every real date + time the pattern gives between "from" and "until" (future only), sorted
const occurrences = computed(() => {
  const from = new Date(`${fromDate.value}T00:00`)
  const until = new Date(`${untilDate.value}T23:59`)
  if (Number.isNaN(from.getTime()) || Number.isNaN(until.getTime()) || until < from) return []
  const now = Date.now()
  const out = []
  const push = (date, mins) => {
    const at = new Date(date)
    at.setHours(Math.floor(mins / 60), mins % 60, 0, 0)
    if (at >= from && at <= until && at.getTime() > now) out.push(at)
  }
  for (const key of chosen.value) {
    const [day, mins] = key.split('-').map(Number) // day: 0 = Mon ... 6 = Sun
    if (repeat.value === 'monthly') {
      // the FIRST of that weekday in every month, e.g. "first Saturday of the month"
      for (let month = new Date(from.getFullYear(), from.getMonth(), 1); month <= until; month.setMonth(month.getMonth() + 1)) {
        const first = new Date(month)
        while ((first.getDay() + 6) % 7 !== day) first.setDate(first.getDate() + 1)
        push(first, mins)
      }
    } else {
      // weekly / every N weeks, counted from the week "from" is in (so all days stay in step)
      const weeks = repeat.value === 'weekly' ? 1 : Math.max(1, Math.floor(everyWeeks.value) || 1)
      const monday = addDays(from, -((from.getDay() + 6) % 7))
      for (let date = addDays(monday, day); date <= until; date = addDays(date, 7 * weeks)) push(date, mins)
    }
  }
  return out.sort((a, b) => a - b)
})
const repeatText = computed(() => {
  if (repeat.value === 'weekly') return 'every week'
  if (repeat.value === 'monthly') return 'on the first of those days each month'
  const n = Math.max(1, Math.floor(everyWeeks.value) || 1)
  return n === 1 ? 'every week' : `every ${n} weeks`
})

// ---- which products + max orders ----
const allProducts = ref(true)
const productIds = ref([])
const capacity = ref(10)

// ---- open / save ----
const modalEl = ref(null)
let modal = null
const saving = ref(false)
const error = ref('')
const done = ref('')
function open() {
  error.value = ''
  done.value = ''
  modal = modal || new bootstrap.Modal(modalEl.value)
  modal.show()
}
defineExpose({ open })

async function save() {
  error.value = ''
  done.value = ''
  if (chosen.value.size === 0) return (error.value = 'Drag across the timetable to choose at least one time.')
  if (occurrences.value.length === 0) return (error.value = 'No future slots fall between those dates. Check the dates.')
  if (occurrences.value.length > MAX_SLOTS) return (error.value = `That makes ${occurrences.value.length} slots; the limit is ${MAX_SLOTS}. Choose a shorter date range.`)
  if (!allProducts.value && productIds.value.length === 0) return (error.value = 'Choose at least one product.')
  if (!Number.isInteger(capacity.value) || capacity.value < 1 || capacity.value > 999) return (error.value = 'Max orders must be a whole number from 1 to 999.')
  saving.value = true
  try {
    const { data } = await axios.post(`${API_URL}/products/shop/${props.shopId}/slots`, {
      starts: occurrences.value.map((d) => d.toISOString()),
      capacity: capacity.value,
      ...(allProducts.value ? {} : { productIds: productIds.value }),
    })
    done.value = `Added ${data.added} ${data.added === 1 ? 'slot' : 'slots'} across ${data.products} ${data.products === 1 ? 'product' : 'products'}.`
      + (data.skipped ? ` ${data.skipped} already existed.` : '')
    chosen.value = new Set()
    emit('saved')
  } catch (err) {
    error.value = err.response?.data?.message || 'Could not add the slots. Please try again.'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <Teleport to="body">
    <div ref="modalEl" class="modal fade" tabindex="-1" aria-labelledby="recurring-title" aria-hidden="true">
      <div class="modal-dialog modal-dialog-scrollable modal-xl">
        <div class="modal-content">
          <div class="modal-header">
            <h5 id="recurring-title" class="modal-title">Recurring collection slots</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>

          <div class="modal-body">
            <div class="recurring-layout">
              <!-- left: the timetable -->
              <section aria-labelledby="grid-help">
                <!-- instructions + Hourly / Every 30 min on one line -->
                <div class="grid-toolbar mb-2">
                  <p id="grid-help" class="small text-muted mb-0">Click or drag across the timetable to open slots. Drag over chosen ones to remove them.</p>
                  <div class="btn-group btn-group-sm flex-shrink-0" role="group" aria-label="Rows">
                    <button type="button" class="btn" :class="step === 60 ? 'btn-brand' : 'btn-outline-secondary'" :aria-pressed="step === 60" @click="changeStep(60)">Hourly</button>
                    <button type="button" class="btn" :class="step === 30 ? 'btn-brand' : 'btn-outline-secondary'" :aria-pressed="step === 30" @click="changeStep(30)">Every 30 min</button>
                  </div>
                </div>

                <div class="week-grid" :style="{ '--rows': times.length }" role="grid" aria-label="Weekly timetable">
                  <div class="corner" aria-hidden="true"></div>
                  <div v-for="d in DAYS" :key="d" class="day-head" role="columnheader">{{ d }}</div>
                  <template v-for="mins in times" :key="mins">
                    <div class="time-head" role="rowheader">{{ timeLabel(mins) }}</div>
                    <button v-for="(d, day) in DAYS" :key="d" type="button" class="cell" :class="{ on: isChosen(day, mins) }"
                      :data-cell="cellKey(day, mins)" :aria-pressed="isChosen(day, mins)" :aria-label="`${d} ${timeLabel(mins)}`"
                      @pointerdown="onPointerDown($event, day, mins)"
                      @keydown.enter.prevent="setCell(cellKey(day, mins), !isChosen(day, mins))"
                      @keydown.space.prevent="setCell(cellKey(day, mins), !isChosen(day, mins))"></button>
                  </template>
                </div>
                <div class="d-flex justify-content-between align-items-center mt-2">
                  <span class="small text-muted">{{ chosen.size }} {{ chosen.size === 1 ? 'time' : 'times' }} a week chosen</span>
                  <button v-if="chosen.size" type="button" class="btn btn-link btn-sm p-0" @click="chosen = new Set()">Clear</button>
                </div>
              </section>

              <!-- right: how often, how long, which products -->
              <section class="settings">
                <fieldset class="mb-3">
                  <legend class="form-label fs-6 mb-1">Repeat</legend>
                  <div class="repeat-options">
                    <label class="repeat-option" :class="{ chosen: repeat === 'weekly' }">
                      <input v-model="repeat" class="visually-hidden" type="radio" value="weekly" /> Weekly
                    </label>
                    <label class="repeat-option" :class="{ chosen: repeat === 'monthly' }">
                      <input v-model="repeat" class="visually-hidden" type="radio" value="monthly" /> Monthly
                    </label>
                    <label class="repeat-option" :class="{ chosen: repeat === 'custom' }">
                      <input v-model="repeat" class="visually-hidden" type="radio" value="custom" /> Custom
                    </label>
                  </div>
                  <div v-if="repeat === 'custom'" class="d-flex align-items-center gap-2 mt-2">
                    <label for="every-weeks" class="small">Every</label>
                    <input id="every-weeks" v-model.number="everyWeeks" type="number" min="1" max="52" class="form-control form-control-sm every-input" />
                    <span class="small">weeks</span>
                  </div>
                  <p class="form-text mb-0">{{ repeat === 'monthly' ? 'e.g. the first Saturday of every month.' : `The chosen times repeat ${repeatText}.` }}</p>
                </fieldset>

                <div class="row g-2 mb-3">
                  <div class="col-6">
                    <label class="form-label small mb-1" for="recurring-from">From</label>
                    <input id="recurring-from" v-model="fromDate" type="date" class="form-control form-control-sm" :min="minDate" :max="maxDate" />
                  </div>
                  <div class="col-6">
                    <label class="form-label small mb-1" for="recurring-until">Until</label>
                    <input id="recurring-until" v-model="untilDate" type="date" class="form-control form-control-sm" :min="fromDate" :max="maxDate" />
                  </div>
                </div>

                <div class="mb-3">
                  <label class="form-label small mb-1" for="recurring-cap">Max orders per slot</label>
                  <input id="recurring-cap" v-model.number="capacity" type="number" min="1" max="999" class="form-control form-control-sm cap-input" />
                </div>

                <fieldset class="mb-3">
                  <legend class="form-label fs-6 mb-1">Products</legend>
                  <div class="form-check">
                    <input id="recurring-all" v-model="allProducts" class="form-check-input" type="checkbox" />
                    <label class="form-check-label small" for="recurring-all">All products ({{ products.length }})</label>
                  </div>
                  <div v-if="!allProducts" class="product-picks">
                    <div v-for="p in products" :key="p._id" class="form-check">
                      <input :id="`recurring-p-${p._id}`" v-model="productIds" class="form-check-input" type="checkbox" :value="p._id" />
                      <label class="form-check-label small text-break" :for="`recurring-p-${p._id}`">{{ p.name }}</label>
                    </div>
                  </div>
                </fieldset>

                <!-- preview -->
                <div class="preview" aria-live="polite">
                  <strong>{{ occurrences.length }} {{ occurrences.length === 1 ? 'slot' : 'slots' }}</strong>
                  <span v-if="occurrences.length" class="small text-muted d-block">
                    {{ formatDateTime(occurrences[0]) }} &rarr; {{ formatDateTime(occurrences[occurrences.length - 1]) }}
                  </span>
                  <span v-else class="small text-muted d-block">Choose times on the timetable.</span>
                </div>
              </section>
            </div>
          </div>

          <div class="modal-footer">
            <p v-if="error" class="text-danger small me-auto mb-0" role="alert">{{ error }}</p>
            <p v-else-if="done" class="text-success small me-auto mb-0" role="status">{{ done }}</p>
            <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Close</button>
            <button type="button" class="btn btn-brand" :disabled="saving || occurrences.length === 0" @click="save">
              {{ saving ? 'Adding...' : `Add ${occurrences.length} ${occurrences.length === 1 ? 'slot' : 'slots'}` }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.recurring-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 280px;
  gap: 1.5rem;
}
@media (max-width: 991.98px) {
  .recurring-layout { grid-template-columns: 1fr; }
}

.grid-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}
.grid-toolbar p {
  min-width: 0; /* the text wraps, the toggle stays on this line */
}
.grid-toolbar .btn {
  white-space: nowrap;
}

/* ---- timetable: time column + 7 day columns ---- */
.week-grid {
  display: grid;
  grid-template-columns: 68px repeat(7, minmax(0, 1fr));
  border: 1px solid var(--line);
  border-radius: 0.75rem;
  overflow: hidden;
  user-select: none;
  touch-action: none; /* dragging a finger paints cells instead of scrolling */
}
.corner,
.day-head {
  padding: 0.4rem 0;
  border-bottom: 1px solid var(--line);
  background: var(--surface-soft);
  font-size: 0.8rem;
  font-weight: 600;
  text-align: center;
  color: var(--ink);
}
.time-head {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding-right: 0.45rem;
  border-bottom: 1px solid var(--line);
  font-size: 0.7rem;
  color: var(--muted);
  white-space: nowrap;
}
.cell {
  height: 26px;
  padding: 0;
  border: 0;
  border-left: 1px solid var(--line);
  border-bottom: 1px solid var(--line);
  background: var(--surface);
  cursor: pointer;
  transition: background 0.08s ease;
}
.cell:hover {
  background: var(--ocean-soft);
}
.cell.on {
  background: var(--ocean);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.35);
}
.cell:focus-visible {
  outline: 2px solid var(--navy);
  outline-offset: -2px;
}

/* ---- settings ---- */
.repeat-options {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.4rem;
}
.repeat-option {
  padding: 0.35rem 0.5rem;
  border: 1px solid var(--line);
  border-radius: 999px;
  font-size: 0.85rem;
  text-align: center;
  cursor: pointer;
}
.repeat-option.chosen {
  border-color: var(--ocean);
  background: var(--ocean-soft);
  color: var(--ocean-dark);
  font-weight: 600;
}
.repeat-option:has(input:focus-visible) {
  outline: 2px solid var(--ocean);
  outline-offset: 2px;
}
.every-input { width: 70px; }
.cap-input { width: 110px; }
.product-picks {
  max-height: 160px;
  margin-top: 0.4rem;
  padding: 0.5rem 0.6rem;
  overflow-y: auto;
  border: 1px solid var(--line);
  border-radius: 0.6rem;
}
.preview {
  padding: 0.75rem 0.9rem;
  border-radius: 0.75rem;
  background: var(--tile);
}
</style>
