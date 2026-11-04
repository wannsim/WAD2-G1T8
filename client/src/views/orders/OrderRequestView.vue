<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import axios from 'axios'
import { API_URL } from '@/utils/config'
import { currentUser } from '@/utils/auth'
import { formatPrice, formatDateTime } from '@/utils/format'

// Owner: Basile - buyer sends an order REQUEST (/order/new/:productId)
const route = useRoute()
const router = useRouter()
const product = ref(null)
const quantity = ref(1)
const customisation = ref('')
const fulfilment = ref('pickup')
const requestedTime = ref('')
const deliveryAddress = ref('')
const deliveryUnit = ref('')
const deliveryPostalCode = ref('')
const saveAddress = ref(false)
const savedAddress = ref(null) // the buyer's default address from their profile
const addressChanged = computed(() => !savedAddress.value
  || deliveryAddress.value !== savedAddress.value.deliveryAddress
  || deliveryUnit.value !== savedAddress.value.deliveryUnit
  || deliveryPostalCode.value !== savedAddress.value.deliveryPostalCode)
const error = ref('')
const loading = ref(true)
const loadError = ref('')
const submitting = ref(false)
const sent = ref(false)
// a short celebration (bag drops in, confetti, tick) between "Send request" and the confirmation card
const celebrating = ref(false)
const celebrateDone = ref(false) // second half: the bag has turned into a tick
let celebrateTimers = []
const CONFETTI_COLOURS = ['#4d63ff', '#7fd0dc', '#e3a63a', '#e5484d', '#1f8a5b', '#8a5cd6']
// 28 pieces flying out in a circle, each a little different
const confetti = Array.from({ length: 28 }, (_, i) => {
  const angle = (i / 28) * 2 * Math.PI + Math.random() * 0.3
  const distance = 90 + Math.random() * 70
  return {
    id: i,
    style: {
      '--x': `${Math.cos(angle) * distance}px`,
      '--y': `${Math.sin(angle) * distance - 30}px`,
      '--r': `${Math.round(Math.random() * 540 - 270)}deg`,
      '--d': `${Math.round(Math.random() * 120)}ms`,
      background: CONFETTI_COLOURS[i % CONFETTI_COLOURS.length],
      borderRadius: i % 3 === 0 ? '50%' : '2px',
    },
  }
})
function showConfirmation() {
  celebrateTimers.forEach(clearTimeout)
  celebrateTimers = []
  celebrating.value = false
  sent.value = true
}
function celebrate() {
  // people who turned off animations go straight to the confirmation
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return showConfirmation()
  celebrateDone.value = false
  celebrating.value = true
  celebrateTimers = [setTimeout(() => (celebrateDone.value = true), 900), setTimeout(showConfirmation, 2100)]
}
onBeforeUnmount(() => celebrateTimers.forEach(clearTimeout))
const chatBusy = ref(false)
const chatError = ref('')

const total = computed(() => (product.value ? product.value.price * quantity.value : 0))

// Keeps only slots that start in the future.
const futureSlots = computed(() => {
  const slots = []
  if (!product.value) return slots
  const now = new Date().getTime()
  for (let i = 0; i < product.value.orderSlots.length; i++) {
    const slot = product.value.orderSlots[i]
    if (new Date(slot.start).getTime() > now) { // Only future slots may be chosen.
      slots.push(slot)
    }
  }
  return slots
})

// Slots that can still be booked (future and not full), from the server. null = could not check, so use futureSlots.
const openSlotList = ref(null)
const openSlots = computed(() => openSlotList.value ?? futureSlots.value)
// No slot left: the buyer can still ask for DELIVERY at a time they suggest (pickup needs a slot).
const noSlots = computed(() => openSlots.value.length === 0)
const canRequestDelivery = computed(() => noSlots.value && product.value?.shop?.delivery !== false)
// option cards: why each one can't be chosen ('' = it can)
const deliveryOffered = computed(() => product.value?.shop?.delivery !== false)
const pickupBlocked = computed(() => {
  if (!product.value?.shop?.pickup) return "This shop doesn't offer pickup"
  if (noSlots.value) return 'No pickup slots left. Choose delivery and suggest a time.'
  return ''
})
// earliest time for the suggested-time box: the start of tomorrow, as "2026-10-30T00:00" (the seller needs a day's notice)
function startOfTomorrow() {
  const day = new Date()
  day.setHours(24, 0, 0, 0)
  return day
}
const minRequestTime = computed(() => {
  const day = startOfTomorrow()
  return new Date(day.getTime() - day.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
})

// Loads the product and chooses delivery when pickup is not offered.
async function loadProduct() {
  try {
    const response = await axios.get(`${API_URL}/products/${route.params.productId}`)
    product.value = response.data
    try {
      const slotsResponse = await axios.get(`${API_URL}/orders/open-slots/${product.value._id}`)
      openSlotList.value = slotsResponse.data
    } catch (err) {
      openSlotList.value = null // fall back to all future slots; the server still checks when sending
    }
    if ((!product.value.shop.pickup || noSlots.value) && product.value.shop.delivery) { // Use an option the shop offers.
      fulfilment.value = 'delivery'
    }
    loading.value = false
  } catch (err) {
    loadError.value = 'We could not load this product. Please go back and try again.' // Failed loads must show a message.
    loading.value = false
  }
}

// Fills the delivery fields with the buyer's saved address, if they have one.
async function loadSavedAddress() {
  try {
    const response = await axios.get(`${API_URL}/users/${currentUser.value._id}`)
    const user = response.data
    savedAddress.value = {
      deliveryAddress: user.deliveryAddress || '',
      deliveryUnit: user.deliveryUnit || '',
      deliveryPostalCode: user.deliveryPostalCode || '',
    }
    deliveryAddress.value = savedAddress.value.deliveryAddress
    deliveryUnit.value = savedAddress.value.deliveryUnit
    deliveryPostalCode.value = savedAddress.value.deliveryPostalCode
    saveAddress.value = !savedAddress.value.deliveryAddress // no address yet: offer to keep this one
  } catch (err) {
    console.log(err.message) // the buyer can still type the address
  }
}

// Checks the login and the role before loading the product.
onMounted(() => {
  if (!currentUser.value) {
    router.push('/login')
    return
  }
  if (currentUser.value.role === 'seller') { // Sellers manage orders on their dashboard; only buyers place orders.
    router.push('/seller/orders')
    return
  }
  loadProduct()
  loadSavedAddress()
})

// Uses the server's error message, or a general message if none is available.
function getErrorMessage(err) {
  if (err.response && err.response.data && err.response.data.message) {
    return err.response.data.message
  }
  return 'Something went wrong. Please try again.'
}

// Opens the buyer's chat with this product's seller.
async function messageSeller() {
  if (chatBusy.value) return // Ignore another chat click while the request is being sent.
  chatError.value = ''
  chatBusy.value = true
  try {
    const response = await axios.post(`${API_URL}/chats/start`, {
      buyer: currentUser.value._id,
      shop: product.value.shop._id,
    })
    router.push('/chats/' + response.data._id)
    chatBusy.value = false
  } catch (err) {
    chatError.value = getErrorMessage(err)
    chatBusy.value = false
  }
}

// Returns the first problem with the form, or an empty string if it is valid.
function validateForm() {
  if (!Number.isInteger(quantity.value) || quantity.value < 1) return 'Quantity must be a whole number, 1 or more.' // Quantity must be a positive whole number.
  if (!requestedTime.value) return noSlots.value ? 'Please suggest a delivery time.' : 'Please choose a pickup time.' // An order needs a time.
  if (noSlots.value && !(new Date(requestedTime.value).getTime() >= startOfTomorrow().getTime())) return 'Please choose a delivery date from tomorrow onwards.'
  if (fulfilment.value !== 'pickup' && fulfilment.value !== 'delivery') return 'Choose pickup or delivery.' // Use one of the two fulfilment options.
  if (fulfilment.value === 'delivery') {
    if (!deliveryAddress.value) return 'Please enter the delivery address.' // Delivery needs somewhere to go.
    if (!/^\d{6}$/.test(deliveryPostalCode.value)) return 'Postal code must be 6 digits.' // Singapore postal codes are 6 digits.
  }
  return ''
}

// Checks the form and sends one request, then shows its result on this page.
async function submitOrder() {
  if (submitting.value) return // Ignore another click while the request is being sent.
  error.value = ''
  const message = validateForm()
  if (message) { // Show the first problem without sending a request.
    error.value = message
    return
  }
  submitting.value = true
  try {
    await axios.post(`${API_URL}/orders`, {
      buyer: currentUser.value._id,
      product: product.value._id,
      quantity: quantity.value,
      customisation: customisation.value,
      fulfilment: fulfilment.value,
      // a suggested time is local ("2026-11-01T10:00"); send it as a full date so the server reads it the same way
      requestedTime: noSlots.value ? new Date(requestedTime.value).toISOString() : requestedTime.value,
      deliveryAddress: deliveryAddress.value,
      deliveryUnit: deliveryUnit.value,
      deliveryPostalCode: deliveryPostalCode.value,
      saveAddress: fulfilment.value === 'delivery' && addressChanged.value && saveAddress.value,
    })
    submitting.value = false
    celebrate() // then the confirmation card
  } catch (err) {
    error.value = getErrorMessage(err)
    submitting.value = false
  }
}
</script>

<template>
  <div class="row justify-content-center">
    <div class="col-12 page-narrow">
      <PageSkeleton v-if="loading" variant="form" :count="4" label="Loading order form" data-testid="order-loading" />
      <div v-else-if="loadError" class="alert alert-danger" data-testid="order-load-error">{{ loadError }}</div>
      <!-- success card: green tick, what happens next, a short summary, then where to go -->
      <!-- celebration: click anywhere on it to skip -->
      <div v-else-if="celebrating" class="celebrate" role="status" aria-live="polite" title="Click to skip" @click="showConfirmation">
        <div class="celebrate-stage" aria-hidden="true">
          <span class="celebrate-ring"></span>
          <span v-for="piece in confetti" :key="piece.id" class="confetti" :style="piece.style"></span>
          <span class="celebrate-badge" :class="{ done: celebrateDone }">
            <!-- shopping bag, then a tick -->
            <svg v-if="!celebrateDone" width="46" height="46" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
              <path d="M18 15v-3a6 6 0 0 1 12 0v3" /><path d="M11 15h26l2 27H9z" />
            </svg>
            <svg v-else width="44" height="44" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round">
              <path class="tick-path" d="M12 25l8 8 16-17" />
            </svg>
          </span>
        </div>
        <p class="celebrate-text">{{ celebrateDone ? 'Order sent!' : `Sending your order to ${product.shop.name}...` }}</p>
      </div>
      <section v-else-if="sent && product" class="success-card" role="status" data-testid="order-success">
        <div class="success-tick" aria-hidden="true">
          <svg width="34" height="34" viewBox="0 0 16 16" fill="currentColor"><path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0" /></svg>
        </div>
        <h2 class="success-title">Order requested</h2>
        <p class="success-text text-break">
          We sent your request to <strong>{{ product.shop.name }}</strong>. The seller will accept, decline or suggest
          another time, and we'll notify you. Until then you can cancel it for free in My orders.
        </p>
        <dl class="success-summary">
          <div><dt>Item</dt><dd class="text-break">{{ product.name }} &times; {{ quantity }}</dd></div>
          <div><dt>{{ fulfilment === 'delivery' ? 'Delivery' : 'Pickup' }}</dt><dd>{{ formatDateTime(requestedTime) }}</dd></div>
          <div><dt>Total</dt><dd>{{ formatPrice(product.price * quantity) }}</dd></div>
        </dl>
        <div class="success-actions">
          <RouterLink to="/orders" class="btn success-primary" data-testid="order-view-orders-link">Go to My orders</RouterLink>
          <RouterLink to="/browse" class="btn success-secondary">Keep browsing</RouterLink>
        </div>
      </section>
      <div v-else-if="product && product.isAvailable === false" class="alert alert-warning" data-testid="order-unavailable">
        This product is not available right now. Please browse other products.
      </div>
      <div v-else-if="noSlots && !canRequestDelivery" class="alert alert-info" data-testid="order-no-slots">
        <p class="mb-2">No upcoming slots for this product.</p>
        <div v-if="currentUser && currentUser.role === 'buyer'">
          <div class="d-flex flex-wrap gap-2">
            <button type="button" class="btn btn-sm btn-secondary" :disabled="chatBusy" @click="messageSeller" data-testid="order-message-seller">Message seller</button>
          </div>
          <p v-if="chatError" class="text-danger small mt-2 mb-0" data-testid="order-chat-error">{{ chatError }}</p>
        </div>
      </div>
      <div v-else-if="product" data-testid="order-form">
        <h2 class="page-title text-break">Request: {{ product.name }}</h2>
        <p class="text-muted text-break">from {{ product.shop.name }} &middot; {{ formatPrice(product.price) }} / {{ product.unit }}</p>
        <div v-if="error" class="alert alert-danger" data-testid="order-error">{{ error }}</div>

        <div class="mb-3">
          <label class="form-label" for="quantity">Quantity</label>
          <input type="number" min="1" class="form-control" id="quantity" v-model.number="quantity" data-testid="order-quantity" />
        </div>

        <div v-if="product.customisable" class="mb-3">
          <label class="form-label" for="customisation">Customisation (flavour, message, colours...)</label>
          <textarea class="form-control" rows="2" maxlength="200" id="customisation" v-model.trim="customisation" data-testid="order-customisation"></textarea>
        </div>

        <!-- how to get it: two big option cards; the inputs below change with the choice -->
        <fieldset class="mb-4">
          <legend class="form-label fs-6">How would you like to get it?</legend>
          <div class="fulfil-options">
            <label class="fulfil-card" :class="{ chosen: fulfilment === 'delivery', unavailable: !deliveryOffered }">
              <input class="visually-hidden" type="radio" name="fulfilment" value="delivery" v-model="fulfilment"
                :disabled="!deliveryOffered" data-testid="order-fulfilment-delivery" />
              <svg class="fulfil-icon" width="52" height="52" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M9 9h8l3 3M39 9h-8l-3 3" /><circle cx="24" cy="12" r="3.5" />
                <path d="M17 31V22a7 7 0 0 1 14 0v9" /><rect x="20.5" y="25" width="7" height="17" rx="3.5" />
              </svg>
              <span class="fulfil-title">Delivery</span>
              <span class="fulfil-sub">{{ deliveryOffered ? 'To your address' : 'Not offered by this shop' }}</span>
            </label>
            <label class="fulfil-card" :class="{ chosen: fulfilment === 'pickup', unavailable: !!pickupBlocked }">
              <input class="visually-hidden" type="radio" name="fulfilment" value="pickup" v-model="fulfilment"
                :disabled="!!pickupBlocked" :aria-describedby="pickupBlocked ? 'pickup-why' : undefined" data-testid="order-fulfilment-pickup" />
              <svg class="fulfil-icon" width="52" height="52" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M18 15v-3a6 6 0 0 1 12 0v3" /><path d="M11 15h26l2 27H9z" />
              </svg>
              <span class="fulfil-title">Pickup</span>
              <span v-if="pickupBlocked" id="pickup-why" class="fulfil-sub why" data-testid="order-pickup-why">{{ pickupBlocked }}</span>
              <span v-else class="fulfil-sub">Free{{ product.shop.nearestMrt ? ` · near ${product.shop.nearestMrt} MRT` : '' }}</span>
            </label>
          </div>
        </fieldset>

        <!-- pickup: choose one of the seller's slots -->
        <div v-if="fulfilment === 'pickup'" class="mb-3">
          <label class="form-label" for="requested-time">Pickup time</label>
          <select class="form-select" id="requested-time" v-model="requestedTime" data-testid="order-time">
            <option disabled value="">Please select one</option>
            <option v-for="slot in openSlots" :key="slot._id" :value="slot.start">{{ formatDateTime(slot.start) }}</option>
          </select>
        </div>

        <!-- delivery: a slot, or (no slots left) a time the buyer suggests -->
        <template v-else>
          <div v-if="noSlots" class="alert alert-info small" data-testid="order-no-slots-delivery">
            No slots are left for this product, but you can still request <strong>delivery</strong> at a time that suits you.
            The seller will accept it or suggest another time.
          </div>
          <div class="mb-3">
            <label class="form-label" for="requested-time">{{ noSlots ? 'Preferred delivery time' : 'Delivery time' }}</label>
            <input v-if="noSlots" type="datetime-local" class="form-control" id="requested-time" v-model="requestedTime"
              :min="minRequestTime" data-testid="order-time" />
            <select v-else class="form-select" id="requested-time" v-model="requestedTime" data-testid="order-time">
              <option disabled value="">Please select one</option>
              <option v-for="slot in openSlots" :key="slot._id" :value="slot.start">{{ formatDateTime(slot.start) }}</option>
            </select>
          </div>
        </template>

        <div v-if="currentUser && currentUser.role === 'buyer'" class="small mb-3">
          <div class="d-flex flex-wrap gap-2">
            <span>None of these times work?</span>
            <button type="button" class="btn btn-link btn-sm p-0" :disabled="chatBusy" @click="messageSeller" data-testid="order-message-seller">Message seller</button>
          </div>
          <p v-if="chatError" class="text-danger small mt-2 mb-0" data-testid="order-chat-error">{{ chatError }}</p>
        </div>

        <fieldset v-if="fulfilment === 'delivery'" class="mb-3 delivery-box" data-testid="order-delivery-address">
          <legend class="form-label fs-6 mb-1">Deliver to</legend>
          <p v-if="savedAddress && savedAddress.deliveryAddress && !addressChanged" class="form-text mt-0 mb-2">
            From your profile. Change it here for this order only.
          </p>
          <div class="row g-2">
            <div class="col-12">
              <label class="visually-hidden" for="order-address">Street address</label>
              <input id="order-address" v-model.trim="deliveryAddress" class="form-control" maxlength="200" placeholder="Block and street, e.g. 123 Bishan Street 12" autocomplete="street-address" data-testid="order-address" />
            </div>
            <div class="col-6">
              <label class="visually-hidden" for="order-unit">Unit number</label>
              <input id="order-unit" v-model.trim="deliveryUnit" class="form-control" maxlength="30" placeholder="Unit, e.g. #05-123" data-testid="order-unit" />
            </div>
            <div class="col-6">
              <label class="visually-hidden" for="order-postal">Postal code</label>
              <input id="order-postal" v-model.trim="deliveryPostalCode" class="form-control" inputmode="numeric" maxlength="6" placeholder="Postal code" autocomplete="postal-code" data-testid="order-postal" />
            </div>
          </div>
          <div v-if="addressChanged" class="form-check mt-2">
            <input id="save-address" v-model="saveAddress" class="form-check-input" type="checkbox" data-testid="order-save-address" />
            <label class="form-check-label small" for="save-address">Save as my default address</label>
          </div>
        </fieldset>

        <p class="fw-bold" data-testid="order-total">Total: {{ formatPrice(total) }}</p>
        <div class="d-flex flex-wrap gap-2">
          <button class="btn btn-brand" :disabled="submitting" @click="submitOrder" data-testid="order-submit">
            <template v-if="submitting">
              <span class="spinner-border spinner-border-sm"></span> Sending…
            </template>
            <template v-else>Send request</template>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ---- celebration before the confirmation ---- */
.celebrate {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 380px;
  cursor: pointer;
  user-select: none;
}
.celebrate-stage {
  position: relative;
  display: grid;
  place-items: center;
  width: 140px;
  height: 140px;
}
/* the bag drops in and bounces */
.celebrate-badge {
  position: relative;
  z-index: 2;
  display: grid;
  place-items: center;
  width: 104px;
  height: 104px;
  border-radius: 50%;
  background: var(--ocean);
  color: #fff;
  box-shadow: 0 14px 34px rgba(var(--ocean-rgb), 0.35);
  animation: bag-drop 0.75s cubic-bezier(0.34, 1.56, 0.64, 1) both;
  transition: background 0.3s ease, box-shadow 0.3s ease;
}
/* ...then turns green with a tick */
.celebrate-badge.done {
  background: #2e8b57;
  box-shadow: 0 14px 34px rgba(46, 139, 87, 0.35);
  animation: badge-pop 0.4s ease;
}
.tick-path {
  stroke-dasharray: 40;
  stroke-dashoffset: 40;
  animation: draw-tick 0.45s 0.1s ease forwards;
}
/* a soft ring ripples out when it lands */
.celebrate-ring {
  position: absolute;
  inset: 18px;
  border-radius: 50%;
  border: 3px solid var(--ocean);
  opacity: 0;
  animation: ring-out 0.9s 0.55s ease-out;
}
/* confetti bursts out from the middle */
.confetti {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 9px;
  height: 9px;
  margin: -4.5px 0 0 -4.5px;
  opacity: 0;
  animation: confetti-burst 1.3s calc(0.55s + var(--d)) cubic-bezier(0.15, 0.7, 0.4, 1) forwards;
}
.celebrate-text {
  margin: 1.5rem 0 0;
  font-size: 1.15rem;
  font-weight: 600;
  color: var(--ink);
  animation: text-in 0.4s 0.3s ease both;
}
@keyframes bag-drop {
  0% { opacity: 0; transform: translateY(-120px) scale(0.6); }
  60% { opacity: 1; }
  100% { transform: none; }
}
@keyframes badge-pop {
  50% { transform: scale(1.12); }
}
@keyframes draw-tick {
  to { stroke-dashoffset: 0; }
}
@keyframes ring-out {
  0% { opacity: 0.6; transform: scale(1); }
  100% { opacity: 0; transform: scale(1.9); }
}
@keyframes confetti-burst {
  0% { opacity: 1; transform: translate(0, 0) rotate(0) scale(0.4); }
  70% { opacity: 1; }
  100% { opacity: 0; transform: translate(var(--x), calc(var(--y) + 60px)) rotate(var(--r)) scale(1); }
}
@keyframes text-in {
  from { opacity: 0; transform: translateY(6px); }
}

/* ---- Delivery / Pickup option cards ---- */
.fulfil-options {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
}
.fulfil-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.35rem;
  padding: 1.5rem 1rem 1.25rem;
  border: 2px solid var(--line);
  border-radius: 1rem;
  background: var(--surface);
  box-shadow: 0 2px 10px rgba(var(--navy-rgb), 0.06);
  text-align: center;
  cursor: pointer;
  transition: border-color 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease;
}
.fulfil-card:hover:not(.unavailable) {
  border-color: var(--ocean);
  transform: translateY(-2px);
}
.fulfil-card.chosen {
  border-color: var(--ocean);
  background: var(--ocean-soft);
  box-shadow: 0 6px 18px rgba(var(--ocean-rgb), 0.18);
}
.fulfil-card:has(input:focus-visible) {
  outline: 2px solid var(--ocean);
  outline-offset: 2px;
}
.fulfil-icon {
  margin-bottom: 0.5rem;
  color: var(--ink);
}
.fulfil-card.chosen .fulfil-icon {
  color: var(--ocean-dark);
}
.fulfil-title {
  font-size: 1rem;
  font-weight: 800;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--ink);
}
.fulfil-sub {
  font-size: 0.85rem;
  color: var(--muted);
}
/* can't be chosen: greyed out, the reason stays readable */
.fulfil-card.unavailable {
  cursor: not-allowed;
  background: var(--surface-soft);
  box-shadow: none;
}
.fulfil-card.unavailable .fulfil-icon,
.fulfil-card.unavailable .fulfil-title {
  opacity: 0.4;
}
.fulfil-sub.why {
  color: var(--rose);
  font-weight: 500;
}
@media (max-width: 400px) {
  .fulfil-card { padding: 1.1rem 0.6rem 1rem; }
}

/* ---- "Order requested" card ---- */
.success-card {
  max-width: 560px;
  margin: 2rem auto;
  padding: 2.5rem 2rem 2rem;
  border: 1px solid var(--line);
  border-radius: 1.75rem;
  background: linear-gradient(160deg, var(--surface) 0%, var(--surface-soft) 100%);
  box-shadow: 0 18px 50px rgba(var(--navy-rgb), 0.12);
  text-align: center;
  animation: card-in 0.35s ease both;
}
.success-tick {
  display: grid;
  place-items: center;
  width: 76px;
  height: 76px;
  margin: 0 auto 1.25rem;
  border-radius: 50%;
  background: #2e8b57;
  color: #fff;
  box-shadow: 0 10px 24px rgba(46, 139, 87, 0.3);
  animation: tick-pop 0.45s 0.1s ease both;
}
.success-title {
  margin-bottom: 0.6rem;
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--ink);
}
.success-text {
  max-width: 440px;
  margin: 0 auto 1.25rem;
  color: var(--ink-soft);
}
.success-summary {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.5rem;
  margin: 0 0 1.5rem;
  padding: 0.85rem;
  border-radius: 1rem;
  background: var(--tile);
}
.success-summary dt {
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--muted);
}
.success-summary dd {
  margin: 0;
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--ink);
}
.success-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.75rem;
}
.success-primary,
.success-secondary {
  padding: 0.6rem 1.4rem;
  border-radius: 999px;
  font-weight: 500;
}
.success-primary {
  background: var(--navy);
  color: #fff;
  box-shadow: 0 8px 20px rgba(var(--navy-rgb), 0.25);
}
.success-primary:hover {
  background: var(--ocean-dark);
  color: #fff;
}
.success-secondary {
  background: var(--surface);
  color: var(--ink);
  border: 1px solid var(--line);
}
.success-secondary:hover {
  background: var(--surface-hover);
}
@keyframes card-in {
  from { opacity: 0; transform: translateY(12px); }
}
@keyframes tick-pop {
  from { opacity: 0; transform: scale(0.5); }
  70% { transform: scale(1.08); }
}
@media (max-width: 575.98px) {
  .success-card { padding: 2rem 1.25rem 1.5rem; }
  .success-summary { grid-template-columns: 1fr; text-align: left; }
  .success-actions .btn { flex: 1 1 100%; }
}
@media (prefers-reduced-motion: reduce) {
  .success-card, .success-tick { animation: none; }
}

.delivery-box {
  padding: 0.75rem 1rem;
  border: 1px solid var(--line);
  border-radius: 0.75rem;
  background: var(--surface-hover);
}
</style>
