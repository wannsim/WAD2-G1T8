<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'
import { currentUser } from '@/utils/auth'
import { API_URL } from '@/utils/config'
import { formatDateTime, formatPrice, capitalize } from '@/utils/format'
import ReasonModal from '@/components/ReasonModal.vue'
import { calendarStatus, calendarEvents } from './calendarApi.js'

// Tile icon paths are copied from SellerOrdersView.vue.
const ICONS = {
  bag: 'M8 1a2.5 2.5 0 0 1 2.5 2.5V4h-5v-.5A2.5 2.5 0 0 1 8 1m3.5 3v-.5a3.5 3.5 0 1 0-7 0V4H1v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V4z',
  chat: 'M5 8a1 1 0 1 1-2 0 1 1 0 0 1 2 0m4 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0m3 1a1 1 0 1 0 0-2 1 1 0 0 0 0 2m-9.083 4.725a.5.5 0 0 0-.512-.45c-.416.022-.81.06-1.163.11A6.95 6.95 0 0 0 2.65 12.4C1.05 11.04 0 9.13 0 7c0-3.866 3.582-7 8-7s8 3.134 8 7-3.582 7-8 7c-1.264 0-2.46-.256-3.524-.71a.5.5 0 0 0-.32-.026c-.67.183-1.54.36-2.556.408l-.006.001a.5.5 0 0 1-.466-.668c.243-.66.432-1.31.543-1.963z',
  clock: 'M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0M8 3.5a.5.5 0 0 0-1 0V9a.5.5 0 0 0 .252.434l3.5 2a.5.5 0 0 0 .496-.868L8 8.71z',
  check: 'M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0m-3.97-3.03a.75.75 0 0 0-1.08.022L7.477 9.417 5.384 7.323a.75.75 0 0 0-1.06 1.06L6.97 11.03a.75.75 0 0 0 1.079-.02l3.992-4.99a.75.75 0 0 0-.01-1.05z',
}

const router = useRouter()
const orders = ref([])
const shop = ref(null)
const loading = ref(true)
const error = ref('')
const calendar = ref({ enabled: false, connected: false })
const googleEvents = ref([])
const weekStart = ref(mondayFor(new Date()))
const selectedDay = ref(new Date().getDay() === 0 ? 6 : new Date().getDay() - 1)
const selectedId = ref('')
const hoverId = ref('')
// Action state is copied from SellerOrdersView.vue.
const proposals = ref({})
const message = ref('')
const busyId = ref('')
const confirmId = ref('')
const confirmStatus = ref('')
const reasonModal = ref(null)
const proposeOpenId = ref('')
const chatBusyId = ref('')
const chatError = ref('')
const hours = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21]
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const KIND_LABELS = { 'needs-reply': 'Needs reply', 'waiting-buyer': 'Waiting on buyer', accepted: 'Accepted', overdue: 'Overdue', done: 'Done' }
// Full day names for the day panel's title, e.g. "Sunday 2 Nov".
const FULL_DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const LEGEND = ['needs-reply', 'waiting-buyer', 'accepted', 'overdue', 'done']

// Returns Monday at midnight for the date's local week.
function mondayFor(value) {
  const date = new Date(value)
  let offset = date.getDay() - 1
  if (date.getDay() === 0) offset = 6
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() - offset)
}

// Checks whether two dates are on the same local day.
function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

// Gives headings a short date without adding a date-formatting library.
function dateLabel(value) {
  const date = new Date(value)
  return `${DAY_NAMES[date.getDay()]}, ${date.getDate()} ${MONTH_NAMES[date.getMonth()]} ${date.getFullYear()}`
}

// Shows a time as two hour digits and two minute digits.
function shortTime(value) {
  const date = new Date(value)
  const hour = date.getHours()
  const minute = date.getMinutes()
  return `${hour < 10 ? '0' : ''}${hour}:${minute < 10 ? '0' : ''}${minute}`
}

// Labels the visible hours from eight in the morning to nine at night.
function hourLabel(hour) {
  let number = hour
  if (hour > 12) number -= 12
  return `${number} ${hour < 12 ? 'am' : 'pm'}`
}

// Places early or late times in the first or last visible hour row.
function hourRow(value) {
  let hour = new Date(value).getHours()
  if (hour < 8) hour = 8
  if (hour > 21) hour = 21
  return hour - 8 + 2
}

// Reads Google's date-only all-day values as local dates, not UTC midnight.
function eventDate(value) {
  if (typeof value === 'string' && value.length === 10) {
    const parts = value.split('-')
    return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]))
  }
  return new Date(value)
}

// Lists the seven shown dates and marks today.
const days = computed(() => {
  const list = []
  const start = weekStart.value
  for (let i = 0; i < 7; i++) {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)
    list.push({ date, label: DAY_NAMES[date.getDay()], number: date.getDate(), month: MONTH_NAMES[date.getMonth()], isToday: sameDay(date, new Date()) })
  }
  return list
})

// Short Monday-to-Sunday range above the grid, e.g. "27 Oct – 2 Nov 2026".
const weekRange = computed(() => {
  const first = days.value[0].date
  const last = days.value[6].date
  return `${first.getDate()} ${MONTH_NAMES[first.getMonth()]} – ${last.getDate()} ${MONTH_NAMES[last.getMonth()]} ${last.getFullYear()}`
})

// Title of the day panel: "Sunday 2 Nov", or "Today, Saturday 1 Nov" for today.
function panelTitle(value) {
  const date = new Date(value)
  const title = `${FULL_DAY_NAMES[date.getDay()]} ${date.getDate()} ${MONTH_NAMES[date.getMonth()]}`
  if (sameDay(date, new Date())) return `Today, ${title}`
  return title
}

// Checks accepted orders for a passed pickup time, copied from SellerOrdersView.vue.
function isOverdue(order) {
  return order.status === 'accepted' && new Date(order.requestedTime).getTime() < new Date().getTime()
}

// Chooses a calendar colour from the order's current status.
function orderKind(order) {
  if (isOverdue(order)) return 'overdue'
  if (order.status === 'pending') return 'needs-reply'
  if (order.status === 'rescheduled') return 'waiting-buyer'
  if (order.status === 'accepted') return 'accepted'
  return 'done'
}

// Places this week's orders using their requested time; declined and cancelled orders stay out.
const weekOrders = computed(() => {
  const list = []
  for (let i = 0; i < orders.value.length; i++) {
    const order = orders.value[i]
    if (order.status === 'declined' || order.status === 'cancelled') continue
    const date = new Date(order.requestedTime)
    for (let j = 0; j < days.value.length; j++) {
      if (sameDay(date, days.value[j].date)) list.push({ order, dayIndex: j, row: hourRow(date), kind: orderKind(order), time: shortTime(date) })
    }
  }
  return list
})

// Temporarily previews a hovered order's day without changing the clicked selection.
const panelDay = computed(() => {
  for (let i = 0; i < weekOrders.value.length; i++) {
    const entry = weekOrders.value[i]
    if (entry.order._id === hoverId.value) return entry.dayIndex
  }
  return selectedDay.value
})

// Lists the orders for the selected or previewed day.
const dayOrders = computed(() => {
  const list = []
  for (let i = 0; i < weekOrders.value.length; i++) {
    const entry = weekOrders.value[i]
    if (entry.dayIndex === panelDay.value) list.push(entry.order)
  }
  return list
})

// Splits outside Google events by day, keeping their exclusive end dates.
const busy = computed(() => {
  const list = []
  if (!calendar.value.connected) return list
  for (let i = 0; i < googleEvents.value.length; i++) {
    const event = googleEvents.value[i]
    if (event.ours) continue
    const start = eventDate(event.start)
    const end = eventDate(event.end)
    if (!(start.getTime() < end.getTime())) continue
    for (let j = 0; j < days.value.length; j++) {
      const day = days.value[j].date
      const nextDay = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1)
      if (start.getTime() >= nextDay.getTime() || end.getTime() <= day.getTime()) continue
      let from = start
      let to = end
      if (from.getTime() < day.getTime()) from = day
      if (to.getTime() > nextDay.getTime()) to = nextDay
      list.push({ id: `${event.id}-${j}`, dayIndex: j, row: hourRow(from), endRow: hourRow(new Date(to.getTime() - 1)), title: event.title, time: `${shortTime(from)} – ${shortTime(to)}` })
    }
  }
  return list
})

// Lists each outside Google event once for the day panel.
const dayBusy = computed(() => {
  const list = []
  for (let i = 0; i < busy.value.length; i++) {
    if (busy.value[i].dayIndex === panelDay.value) list.push(busy.value[i])
  }
  return list
})

// Groups each day and hour so overlapping entries stack instead of hiding each other.
const gridSlots = computed(() => {
  const list = []
  for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
    for (let row = 2; row < hours.length + 2; row++) {
      const slotOrders = []
      const slotBusy = []
      for (let i = 0; i < weekOrders.value.length; i++) {
        const entry = weekOrders.value[i]
        if (entry.dayIndex === dayIndex && entry.row === row) slotOrders.push(entry)
      }
      for (let i = 0; i < busy.value.length; i++) {
        const entry = busy.value[i]
        if (entry.dayIndex === dayIndex && entry.row <= row && entry.endRow >= row) slotBusy.push(entry)
      }
      list.push({ key: `${dayIndex}-${row}`, dayIndex, row, orders: slotOrders, busy: slotBusy })
    }
  }
  return list
})

// Counts the same four dashboard totals, copied from SellerOrdersView.vue.
const counts = computed(() => {
  let accepted = 0
  let needs = 0
  let overdue = 0
  let active = 0
  for (let i = 0; i < orders.value.length; i++) {
    const order = orders.value[i]
    if (order.status === 'accepted') accepted++
    if (order.status === 'pending') needs++
    if (isOverdue(order)) overdue++
    if (['pending', 'rescheduled', 'accepted'].includes(order.status)) active++
  }
  return { accepted, needs, overdue, active }
})

// Tile wording, tones and test ids are copied from SellerOrdersView.vue.
const statTiles = computed(() => [
  { key: 'accepted', tone: 'blue', icon: ICONS.bag, label: 'Accepted', value: counts.value.accepted, hint: 'Pickups coming up', testid: 'stat-upcoming' },
  { key: 'needs', tone: 'amber', icon: ICONS.chat, label: 'Needs reply', value: counts.value.needs, hint: 'Waiting for your answer', testid: 'stat-needs-reply' },
  { key: 'overdue', tone: 'rose', icon: ICONS.clock, label: 'Overdue', value: counts.value.overdue, hint: 'Pickup time has passed', testid: 'stat-overdue' },
  { key: 'active', tone: 'green', icon: ICONS.check, label: 'Total active', value: counts.value.active, hint: 'Not completed yet', testid: 'stat-total-active' },
])

// Uses the server's error message or a retry instruction, copied from SellerOrdersView.vue.
function getErrorMessage(err) {
  if (err.response && err.response.data && err.response.data.message) return err.response.data.message
  return 'Something went wrong. Please try again.'
}

// Loads the seller's shop and orders, copied from SellerOrdersView.vue.
async function loadOrders() {
  try {
    const shopResponse = await axios.get(`${API_URL}/shops/mine/${currentUser.value._id}`)
    shop.value = shopResponse.data
    if (!shop.value) {
      loading.value = false
      router.push('/seller/shop')
      return
    }
    const response = await axios.get(`${API_URL}/orders/shop/${shop.value._id}`)
    orders.value = response.data
    loading.value = false
  } catch (err) {
    error.value = getErrorMessage(err)
    loading.value = false
  }
}

// Loads Google busy times for the shown week, ignoring an older week's late response.
async function loadBusy() {
  const start = new Date(weekStart.value)
  googleEvents.value = []
  if (!calendar.value.connected) return
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7)
  const events = await calendarEvents(currentUser.value._id, start, end)
  if (start.getTime() === weekStart.value.getTime()) googleEvents.value = events
}

// Chooses a day and closes controls belonging to the previous selection.
function selectDay(index) {
  selectedDay.value = index
  selectedId.value = ''
  hoverId.value = ''
  clearConfirm()
  closeProposal()
}

// Keeps a clicked order and its day selected after the pointer leaves.
function selectOrder(entry) {
  selectedDay.value = entry.dayIndex
  selectedId.value = entry.order._id
  hoverId.value = ''
}

// Starts a changed week on today when present, or on Monday otherwise.
function resetSelection() {
  let index = 0
  for (let i = 0; i < days.value.length; i++) {
    if (days.value[i].isToday) index = i
  }
  selectDay(index)
}

// Moves to the previous week and reloads its busy times.
async function prevWeek() {
  weekStart.value = new Date(weekStart.value.getTime() - 7 * 24 * 60 * 60 * 1000)
  resetSelection()
  await loadBusy()
}

// Moves to the next week and reloads its busy times.
async function nextWeek() {
  weekStart.value = new Date(weekStart.value.getTime() + 7 * 24 * 60 * 60 * 1000)
  resetSelection()
  await loadBusy()
}

// Returns to this week's Monday and reloads its busy times.
async function thisWeek() {
  weekStart.value = mondayFor(new Date())
  resetSelection()
  await loadBusy()
}

// Checks the applicable time before accepting, copied from SellerOrdersView.vue.
function timePassed(order) {
  let time = order.requestedTime
  if (order.status === 'rescheduled') time = order.proposedTime
  return new Date(time).getTime() < new Date().getTime()
}

// Explains passed-time warnings, copied from SellerOrdersView.vue.
function sellerHelp(order) {
  if (isOverdue(order)) return 'The pickup time has passed. Mark it completed or message the buyer.'
  if (order.status === 'pending' && timePassed(order)) return 'The pickup time has passed. Propose a new time or decline.'
  if (order.status === 'rescheduled' && timePassed(order)) return 'Your new time has passed. Message the buyer.'
  return ''
}

// Opens the buyer's chat, copied from SellerOrdersView.vue.
async function messageBuyer(order) {
  if (chatBusyId.value !== '') return
  chatError.value = ''
  chatBusyId.value = order._id
  try {
    const response = await axios.post(`${API_URL}/chats/start`, { buyer: order.buyer._id, shop: shop.value._id })
    router.push('/chats/' + response.data._id)
    chatBusyId.value = ''
  } catch (err) {
    chatError.value = getErrorMessage(err)
    chatBusyId.value = ''
  }
}

// Stores the completion confirmation, copied from SellerOrdersView.vue.
function askConfirm(order, status) {
  confirmId.value = order._id
  confirmStatus.value = status
  proposeOpenId.value = ''
}

// Closes the inline confirmation, copied from SellerOrdersView.vue.
function clearConfirm() {
  confirmId.value = ''
  confirmStatus.value = ''
}

// Gets a decline or cancel reason, copied from SellerOrdersView.vue.
async function askReason(order, status) {
  clearConfirm()
  proposeOpenId.value = ''
  const declining = status === 'declined'
  const reason = await reasonModal.value.ask({
    title: declining ? 'Decline this order?' : 'Cancel this order?',
    hint: 'The buyer will see this reason.',
    confirmLabel: declining ? 'Yes, decline' : 'Yes, cancel',
  })
  if (reason) await updateStatus(order, status, reason)
}

// Opens a fresh proposal input, copied from SellerOrdersView.vue.
function toggleProposal(order) {
  if (proposeOpenId.value === order._id) {
    proposeOpenId.value = ''
  } else {
    proposeOpenId.value = order._id
    proposals.value[order._id] = ''
    clearConfirm()
  }
}

// Closes the proposal input, copied from SellerOrdersView.vue.
function closeProposal() {
  proposeOpenId.value = ''
}

// Updates an order and both displayed data sets, adapted from SellerOrdersView.vue.
async function updateStatus(order, status, reason = '') {
  if (busyId.value !== '') return
  message.value = ''
  error.value = ''
  busyId.value = order._id
  try {
    const response = await axios.put(`${API_URL}/orders/${order._id}/status`, {
      status, userId: currentUser.value._id, proposedTime: proposals.value[order._id], reason,
    })
    if (status === 'accepted') message.value = 'Order accepted.'
    if (status === 'declined') message.value = 'Order declined.'
    if (status === 'rescheduled') message.value = 'New time sent to the buyer.'
    if (status === 'completed') message.value = 'Order marked as completed.'
    if (status === 'cancelled') message.value = 'Order cancelled.'
    if (response.data.calendar) {
      if (response.data.calendar.seller === 'added') message.value += ' Added to your Google Calendar.'
      if (response.data.calendar.seller === 'removed') message.value += ' Removed from your Google Calendar.'
      if (response.data.calendar.seller === 'failed') message.value += ' Your Google Calendar could not be updated.'
    }
    clearConfirm()
    closeProposal()
    busyId.value = ''
    await loadOrders()
    await loadBusy()
  } catch (err) {
    error.value = getErrorMessage(err)
    clearConfirm()
    closeProposal()
    busyId.value = ''
    await loadOrders()
    await loadBusy()
  }
}

// Checks a proposed time before sending it, copied from SellerOrdersView.vue.
async function proposeTime(order) {
  message.value = ''
  error.value = ''
  const proposedTime = proposals.value[order._id]
  if (!proposedTime) {
    error.value = 'Pick a date and time first.'
    return
  }
  if (!(new Date().getTime() < new Date(proposedTime).getTime())) {
    error.value = 'Pick a time in the future.'
    return
  }
  await updateStatus(order, 'rescheduled')
}

// Sends logged-out users to login and buyers to their orders, copied from SellerOrdersView.vue.
onMounted(async () => {
  if (!currentUser.value) {
    router.push('/login')
    return
  }
  if (currentUser.value.role !== 'seller') {
    router.push('/orders')
    return
  }
  await loadOrders()
  calendar.value = await calendarStatus(currentUser.value._id)
  await loadBusy()
})
</script>

<template>
  <div class="row">
    <div class="col-12 calendar-page">
      <RouterLink to="/seller/orders" data-testid="calendar-back">‹ Order dashboard</RouterLink>
      <div class="d-flex justify-content-between align-items-center flex-wrap gap-3 my-3">
        <div>
          <h2 class="page-title mb-1">Pickup calendar</h2>
          <p v-if="calendar.connected" class="small text-body-secondary mb-0">Google Calendar synced</p>
        </div>
        <div class="d-flex align-items-center flex-wrap gap-2">
          <button type="button" class="btn btn-act-outline week-arrow" aria-label="Previous week" @click="prevWeek" data-testid="calendar-prev">‹</button>
          <span class="week-range">{{ weekRange }}</span>
          <button type="button" class="btn btn-act-outline week-arrow" aria-label="Next week" @click="nextWeek" data-testid="calendar-next">›</button>
          <button type="button" class="btn btn-act-outline" @click="thisWeek" data-testid="calendar-today">Today</button>
        </div>
      </div>
      <p v-if="loading" data-testid="seller-orders-loading"><span class="spinner-border spinner-border-sm" aria-hidden="true"></span> Loading…</p>
      <template v-else>
        <div v-if="error" class="alert alert-danger" data-testid="seller-orders-error">{{ error }}</div>
        <div v-if="message" class="alert alert-success" data-testid="seller-orders-message">{{ message }}</div>
        <div v-if="chatError" class="alert alert-danger" data-testid="order-chat-error">{{ chatError }}</div>
        <!-- Tile markup is copied from SellerOrdersView.vue; arrows return to the dashboard. -->
        <div class="stat-grid mb-4">
          <RouterLink v-for="t in statTiles" :key="t.key" to="/seller/orders" class="stat-tile" :class="`tone-${t.tone}`" :data-testid="`tile-${t.key}`" :aria-label="`${t.label}: ${t.value}. Open Order dashboard`">
            <span class="stat-icon" aria-hidden="true"><svg width="22" height="22" viewBox="0 0 16 16" fill="currentColor"><path :d="t.icon" /></svg></span>
            <span class="stat-text"><span class="stat-label">{{ t.label }}</span><span class="stat-value" :data-testid="t.testid">{{ t.value }}</span><span class="stat-hint">{{ t.hint }}</span></span>
            <span class="stat-arrow" aria-hidden="true">›</span>
          </RouterLink>
        </div>
        <ul class="calendar-legend">
          <li v-for="kind in LEGEND" :key="kind"><span class="legend-dot" :class="`kind-${kind}`" aria-hidden="true"></span>{{ KIND_LABELS[kind] }}</li>
          <li><span class="legend-dot calendar-busy" aria-hidden="true"></span>Busy in Google Calendar</li>
        </ul>
        <div class="calendar-workspace">
          <div class="calendar-scroll">
            <div class="calendar-grid" data-testid="calendar-grid">
              <div class="calendar-corner">Time</div>
              <button v-for="(day, index) in days" :key="day.number" type="button" class="calendar-heading" :class="{ 'is-today': day.isToday, 'selected-day': index === selectedDay }" :style="{ gridColumn: index + 2, gridRow: 1 }" :aria-pressed="index === selectedDay" :aria-label="`Show orders on ${dateLabel(day.date)}`" @click="selectDay(index)" data-testid="calendar-day-select"><span class="heading-day">{{ day.isToday ? 'Today' : day.label }}</span><span class="heading-date">{{ day.number }} {{ day.month }}</span></button>
              <div v-for="(hour, index) in hours" :key="hour" class="calendar-hour" :style="{ gridColumn: 1, gridRow: index + 2 }">{{ hourLabel(hour) }}</div>
              <div v-for="slot in gridSlots" :key="slot.key" class="calendar-slot" :class="{ 'selected-column': slot.dayIndex === selectedDay }" :style="{ gridColumn: slot.dayIndex + 2, gridRow: slot.row }">
                <div v-for="event in slot.busy" :key="event.id" class="calendar-busy calendar-block" data-testid="calendar-busy">Busy in Google Calendar<span>{{ event.time }}</span></div>
                <button v-for="entry in slot.orders" :key="entry.order._id" type="button" class="calendar-block calendar-event" :class="`kind-${entry.kind} ${entry.order._id === selectedId || entry.order._id === hoverId ? 'is-highlighted' : ''}`" :aria-label="`${entry.order.product ? entry.order.product.name : 'Product removed'}, ${dateLabel(days[entry.dayIndex].date)}, ${entry.time}, ${KIND_LABELS[entry.kind]}`" @click="selectOrder(entry)" @mouseenter="hoverId = entry.order._id" @mouseleave="hoverId = ''" @focus="hoverId = entry.order._id" @blur="hoverId = ''" data-testid="calendar-event">
                  <strong class="text-break">{{ entry.order.product ? entry.order.product.name : 'Product removed' }}</strong><span>{{ entry.time }} · {{ KIND_LABELS[entry.kind] }}</span>
                </button>
              </div>
            </div>
          </div>
          <section class="day-panel" data-testid="calendar-day" aria-labelledby="calendar-day-title">
            <div class="day-head">
              <h3 id="calendar-day-title">{{ panelTitle(days[panelDay].date) }}</h3>
              <p class="day-count">{{ dayOrders.length }} {{ dayOrders.length === 1 ? 'order' : 'orders' }}</p>
            </div>
            <div class="day-body">
              <p v-if="dayOrders.length === 0" class="text-body-secondary">No orders on this day.</p>
              <article v-for="o in dayOrders" :key="o._id" class="calendar-day-order" :class="{ 'is-highlighted': o._id === selectedId || o._id === hoverId }" tabindex="0" :aria-label="o.product ? o.product.name : 'Product removed'" @mouseenter="hoverId = o._id" @mouseleave="hoverId = ''" @focus="hoverId = o._id" @blur="hoverId = ''" data-testid="calendar-day-order">
                <div class="d-flex justify-content-between align-items-start gap-2">
                  <div class="day-order-name">
                    <h4 class="text-break">{{ o.product ? o.product.name : 'Product removed' }}</h4>
                    <span v-if="isOverdue(o)" class="status-pill pill-overdue" data-testid="order-overdue">Overdue</span>
                    <span v-else class="status-pill" :class="`pill-${o.status}`" data-testid="order-status">{{ capitalize(o.status) }}</span>
                  </div>
                  <span class="day-price" data-testid="order-price">{{ formatPrice(o.totalPrice) }}</span>
                </div>
                <p class="day-facts">{{ shortTime(o.requestedTime) }} · {{ o.buyer ? o.buyer.name : 'Buyer removed' }} · <span data-testid="order-quantity-line">Quantity: {{ o.quantity }}</span> · {{ capitalize(o.fulfilment) }}</p>
                <p v-if="sellerHelp(o)" class="day-warning" data-testid="order-status-help">{{ sellerHelp(o) }}</p>
                <p v-if="o.status === 'rescheduled'" class="small text-body-secondary">Proposed time: {{ formatDateTime(o.proposedTime) }}</p>
                <div class="calendar-actions">
                  <template v-if="o.status === 'pending'">
                    <button type="button" class="btn btn-act-primary" :disabled="busyId !== '' || timePassed(o)" @click="updateStatus(o, 'accepted')" data-testid="order-accept">Accept</button>
                    <button type="button" class="btn btn-act-outline" :disabled="busyId !== ''" @click="toggleProposal(o)" data-testid="order-propose-toggle">Propose new time</button>
                  </template>
                  <button v-else-if="o.status === 'accepted'" type="button" class="btn btn-act-primary action-wide" :disabled="busyId !== ''" @click="askConfirm(o, 'completed')" data-testid="order-complete">Mark completed</button>
                  <button v-if="o.buyer" type="button" class="btn btn-act-outline" :class="{ 'action-wide': o.status === 'rescheduled' || o.status === 'completed' }" :disabled="chatBusyId !== ''" @click="messageBuyer(o)" data-testid="order-message-buyer">Message buyer</button>
                  <button v-if="o.status === 'pending'" type="button" class="btn btn-act-danger" :disabled="busyId !== ''" @click="askReason(o, 'declined')" data-testid="order-decline">Decline</button>
                  <button v-if="o.status === 'accepted'" type="button" class="btn btn-act-danger" :disabled="busyId !== ''" @click="askReason(o, 'cancelled')" data-testid="order-cancel">Cancel order</button>
                </div>
                <div v-if="proposeOpenId === o._id" class="day-inline">
                  <label class="form-label small" :for="'calendar-proposed-' + o._id">New date and time</label>
                  <input type="datetime-local" class="form-control" :id="'calendar-proposed-' + o._id" v-model="proposals[o._id]" :disabled="busyId !== ''" data-testid="order-propose-input" />
                  <button type="button" class="btn btn-act-primary mt-2" :disabled="busyId !== ''" @click="proposeTime(o)" data-testid="order-propose-submit">Send new time</button>
                </div>
                <div v-if="confirmId === o._id && confirmStatus === 'completed'" class="day-inline">
                  <p class="small">Mark this order as completed?</p>
                  <div class="d-flex flex-wrap gap-2">
                    <button type="button" class="btn btn-act-primary" :disabled="busyId !== ''" @click="updateStatus(o, 'completed')" data-testid="order-confirm-yes">Yes, completed</button>
                    <button type="button" class="btn btn-act-outline" :disabled="busyId !== ''" @click="clearConfirm" data-testid="order-confirm-no">Keep order</button>
                  </div>
                </div>
                <p v-if="busyId === o._id" class="small text-body-secondary mt-2 mb-0" data-testid="order-sending"><span class="spinner-border spinner-border-sm" aria-hidden="true"></span> Sending…</p>
              </article>
              <template v-if="calendar.connected">
                <h4 class="google-busy-title">Also in your Google Calendar</h4>
                <p v-if="dayBusy.length === 0" class="small text-body-secondary">No other Google events on this day.</p>
                <p v-for="event in dayBusy" :key="event.id" class="small text-body-secondary text-break">{{ event.time }} · {{ event.title }}</p>
              </template>
            </div>
          </section>
        </div>
      </template>
    </div>
  </div>
  <ReasonModal ref="reasonModal" />
</template>

<style scoped>
/* Dashboard tiles are copied from SellerOrdersView.vue. */
.stat-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 1rem;
}
.stat-tile {
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: 0.9rem;
  padding: 1.1rem 1.1rem 1.4rem;
  overflow: hidden;
  border: 1px solid var(--tile-line);
  border-radius: 1.25rem;
  background: linear-gradient(135deg, var(--tile-from), var(--tile-to));
  text-align: left;
  color: var(--ink);
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}
.stat-tile::after { /* the wave */
  content: '';
  position: absolute;
  right: -20%;
  bottom: -55%;
  width: 80%;
  height: 90%;
  border-radius: 50%;
  background: var(--tile-wave);
  pointer-events: none;
}
.stat-tile:hover,
.stat-tile:focus-visible {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(var(--navy-rgb), 0.08);
}
.tone-amber { --tile-from: #fff8ea; --tile-to: #fdeccb; --tile-line: #f8e2b4; --tile-wave: rgba(var(--amber-rgb), 0.18); }
.tone-blue  { --tile-from: #f4f8fe; --tile-to: #e3ecf9; --tile-line: #d8e4f5; --tile-wave: rgba(var(--aqua-rgb), 0.2); }
.tone-rose  { --tile-from: #fff3f4; --tile-to: #fbe0e3; --tile-line: #f6d2d6; --tile-wave: rgba(var(--rose-rgb), 0.14); }
.tone-green { --tile-from: #f1faf5; --tile-to: #dcf1e5; --tile-line: #c9e8d6; --tile-wave: rgba(35, 128, 74, 0.14); }
.stat-icon {
  position: relative;
  z-index: 1;
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 52px;
  height: 52px;
  border-radius: 50%;
  background: #fff;
  color: var(--navy);
  box-shadow: 0 2px 8px rgba(var(--navy-rgb), 0.08);
}
.tone-green .stat-icon { color: #23804a; }
.stat-text {
  position: relative;
  z-index: 1;
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
}
.stat-label { font-weight: 600; }
.tone-green .stat-label { color: #23804a; }
.stat-value {
  font-size: 2rem;
  font-weight: 700;
  line-height: 1.15;
  color: var(--navy);
}
.stat-hint { font-size: 0.85rem; color: var(--ink-soft); }
.stat-arrow {
  position: relative;
  z-index: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.85);
  font-size: 1.3rem;
  line-height: 1;
  color: var(--navy);
}
.stat-tile { text-decoration: none; }

/* Only the grid scrolls horizontally; the surrounding columns may shrink. */
.calendar-page, .calendar-workspace, .calendar-scroll { min-width: 0; }
.calendar-workspace { display: grid; grid-template-columns: minmax(0, 1fr); gap: 1rem; }
.calendar-scroll { overflow-x: auto; max-width: 100%; border: 1px solid var(--line); border-radius: 1rem; background: var(--surface); }
.calendar-grid { display: grid; grid-template-columns: 3rem repeat(7, minmax(5rem, 1fr)); grid-template-rows: auto repeat(14, minmax(3.5rem, auto)); min-width: 38rem; }
.calendar-corner, .calendar-heading, .calendar-hour { padding: 0.65rem 0.35rem; color: var(--ink-soft); font-size: 0.8rem; }
/* Day headers: weekday (or "Today") on top, date with month below. */
.calendar-heading { display: flex; flex-direction: column; align-items: center; gap: 2px; text-align: center; border-bottom: 1px solid var(--line); background: #f6f9fd; color: #13284b; }
.heading-day { font-size: 0.75rem; font-weight: 500; }
.heading-date { font-size: 0.95rem; font-weight: 700; }
.calendar-slot { min-width: 0; display: flex; flex-direction: column; gap: 0.3rem; padding: 0.3rem; border-left: 1px solid var(--line); border-bottom: 1px solid var(--line); }
.calendar-block { width: 100%; min-width: 0; padding: 0.45rem; border: 1px solid currentColor; border-radius: 0.5rem; font-size: 0.75rem; text-align: left; overflow-wrap: anywhere; }
.calendar-block span { display: block; margin-top: 0.15rem; }
.calendar-event:hover, .calendar-event:focus-visible { outline: 2px solid var(--navy); outline-offset: 1px; }

/* Status colours follow the dashboard's pills; outside busy time is striped grey. */
.kind-needs-reply { background: #fdf0c8; color: #a8740a; }
.kind-waiting-buyer { background: var(--aqua-soft); color: var(--aqua-dark); }
.kind-accepted { background: #e2f3e8; color: #23804a; }
.kind-overdue { background: #fbe4e3; color: #b8312f; }
.kind-done { background: var(--tile); color: var(--ink-soft); }
.calendar-busy { background: repeating-linear-gradient(135deg, var(--tile), var(--tile) 5px, var(--line) 5px, var(--line) 7px); color: var(--ink-soft); }

/* The legend uses plain text beside a small colour sample. */
.calendar-legend { display: flex; flex-wrap: wrap; gap: 0.6rem 1rem; padding: 0; list-style: none; font-size: 0.8rem; }
.calendar-legend li { display: flex; align-items: center; gap: 0.35rem; }
.legend-dot { width: 0.75rem; height: 0.75rem; border: 1px solid currentColor; border-radius: 0.2rem; }

/* The selected day tints its column; only matching order ids receive an outline. */
.calendar-heading { border: 0; border-bottom: 1px solid var(--line); }
.calendar-heading:hover { background: var(--ocean-soft); color: var(--navy); }
.calendar-heading.selected-day { background: #13284b; color: #fff; }
/* White set on both lines too, so nothing can turn them navy on the navy background. */
.calendar-heading.selected-day .heading-day, .calendar-heading.selected-day .heading-date { color: #fff; }
.calendar-heading:focus-visible { outline: 2px solid var(--ocean); outline-offset: -3px; }
.calendar-slot.selected-column { background: var(--surface-soft); }
.calendar-event.is-highlighted, .calendar-day-order.is-highlighted, .calendar-day-order:focus-visible { outline: 2px solid var(--navy); outline-offset: 1px; }

/* The day panel sits below the grid on phones and beside it on larger screens. */
.day-panel { min-width: 0; border: 1px solid var(--line); border-radius: 1rem; background: var(--surface); overflow: hidden; }
/* Day panel header: the white colour is set on the h3 itself, because main.css makes every heading navy. */
.day-head { padding: 14px 18px; background: #13284b; color: #fff; }
.day-head h3 { margin: 0 0 0.2rem; font-size: 1.15rem; font-weight: 700; color: #fff; }
.day-count { margin: 0; font-size: 0.85rem; color: rgba(255, 255, 255, 0.85); }
/* Week controls: bordered square arrows and a bold week range. */
.week-arrow { width: 38px; padding: 0; font-size: 1.1rem; }
.week-range { font-size: 0.95rem; font-weight: 600; color: #13284b; }
.day-body { padding: 1rem; }
.calendar-day-order { padding: 0.75rem; margin-bottom: 1rem; border: 1px solid var(--line); border-radius: 0.8rem; }
.day-order-name { min-width: 0; }
.day-order-name h4 { margin: 0 0 0.4rem; font-size: 1rem; }
.day-price { flex-shrink: 0; font-weight: 700; white-space: nowrap; font-variant-numeric: tabular-nums; }
.day-facts { margin: 0.6rem 0; font-size: 0.8rem; color: var(--ink-soft); overflow-wrap: anywhere; }
.day-warning { color: #b8312f; font-size: 0.85rem; }
.google-busy-title { margin: 1rem 0 0.6rem; font-size: 1rem; }

/* Status pills and action colours are copied from SellerOrdersView.vue. */
.status-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.3rem 0.85rem;
  border-radius: 999px;
  font-size: 0.85rem;
  font-weight: 500;
  white-space: nowrap;
}
.status-pill::before {
  content: '';
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: currentColor;
}
.pill-pending { background: #fdf0c8; color: #a8740a; }
.pill-accepted { background: #e2f3e8; color: #23804a; }
.pill-rescheduled { background: var(--aqua-soft); color: var(--aqua-dark); }
.pill-completed { background: var(--tile); color: var(--ink-soft); }
.pill-declined,
.pill-cancelled,
.pill-overdue { background: #fbe4e3; color: #b8312f; }
/* One button set for every order screen (same values as SellerOrdersView.vue and BuyerOrdersView.vue). */
.btn.btn-act-primary, .btn.btn-act-outline, .btn.btn-act-danger { display: inline-flex; align-items: center; justify-content: center; border: 1.5px solid; border-radius: 999px; min-height: 38px; padding: 0 14px; font-size: 13.5px; font-weight: 600; }
.btn.btn-act-primary { background: #13284b; border-color: #13284b; color: #fff; }
.btn.btn-act-outline { background: #fff; border-color: #c9d5e8; color: #13284b; }
.btn.btn-act-danger { background: #fff; border-color: #f0b9bb; color: #c43c41; }
.btn.btn-act-primary:hover, .btn.btn-act-outline:hover { background: #e8f0fa; border-color: #24498a; color: #13284b; }
.btn.btn-act-danger:hover { background: #fff3f4; border-color: #e5484d; color: #c43c41; }
.btn.btn-act-primary:focus-visible, .btn.btn-act-outline:focus-visible, .btn.btn-act-danger:focus-visible { outline: 2px solid #24498a; outline-offset: 2px; }
.btn.btn-act-primary:disabled, .btn.btn-act-outline:disabled, .btn.btn-act-danger:disabled { opacity: .6; }

/* Each action row has two equal bordered buttons under a divider; wide actions span both columns. */
.calendar-actions { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.5rem; margin-top: 0.25rem; padding-top: 10px; border-top: 1px solid var(--line); }
.calendar-actions .action-wide { grid-column: 1 / -1; }
.calendar-day-order .btn { min-width: 0; }
.day-inline { padding-top: 0.75rem; margin-top: 0.75rem; border-top: 1px solid var(--line); }
@media (min-width: 992px) { .calendar-workspace { grid-template-columns: minmax(0, 2fr) minmax(0, 1fr); align-items: start; } }

/* Tile breakpoints are copied from SellerOrdersView.vue. */
@media (max-width: 991.98px) { .stat-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 575.98px) { .stat-grid { grid-template-columns: 1fr; } }
</style>
