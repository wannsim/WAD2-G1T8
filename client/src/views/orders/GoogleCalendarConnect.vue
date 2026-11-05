<script setup>
import { ref } from 'vue'
import { currentUser } from '@/utils/auth'
import { startCalendarConnect, disconnectCalendar } from './calendarApi.js'

// The page that uses this box owns the status and passes it in, so every page reads the same server answer.
// calendar: { enabled, connected, email, needsPassword } from calendarStatus()
// returnTo: the page Google sends the user back to after Allow or Cancel
// testPrefix: start of every data-testid, so each page keeps its own stable test ids
const props = defineProps({
  calendar: { type: Object, required: true },
  returnTo: { type: String, required: true },
  testPrefix: { type: String, required: true },
})

// connect-open: Connect was clicked (the page clears its old message)
// disconnected: the disconnect worked (the page shows its message and checks the status again)
const emit = defineEmits(['connect-open', 'disconnected'])

// Connect state: the password box, what was typed, a busy flag against double clicks, and the server's error text.
const passwordOpen = ref(false)
const password = ref('') // starts empty and is cleared after every try
const connectBusy = ref(false)
const connectError = ref('')

// Disconnect state: the "are you sure?" box, a busy flag and an error line.
const confirmOpen = ref(false)
const disconnectBusy = ref(false)
const disconnectError = ref('')

// Connect button: password accounts first prove they own this Homly account; Google sign-up accounts go straight on.
async function openConnect() {
  if (connectBusy.value) return
  connectError.value = ''
  emit('connect-open')
  if (props.calendar.needsPassword) passwordOpen.value = true
  else await submitConnect()
}

// Sends the password once to our server, always clears it, then goes to Google or shows the server's message.
async function submitConnect() {
  if (connectBusy.value) return
  if (props.calendar.needsPassword && !password.value) return
  connectBusy.value = true
  connectError.value = ''
  const result = await startCalendarConnect(currentUser.value._id, password.value, props.returnTo)
  password.value = ''
  connectBusy.value = false
  if (result.url) {
    passwordOpen.value = false
    window.location.href = result.url
  } else {
    connectError.value = result.error
  }
}

// Closes the password box and forgets what was typed.
function cancelConnect() {
  if (connectBusy.value) return
  passwordOpen.value = false
  password.value = ''
  connectError.value = ''
}

// Disconnect button: ask first instead of disconnecting straight away.
function askDisconnect() {
  disconnectError.value = ''
  confirmOpen.value = true
}

// "Keep connected": close the question, change nothing.
function keepConnected() {
  if (disconnectBusy.value) return
  confirmOpen.value = false
}

// "Yes, disconnect": one request; on success the page is told, on failure the error shows here.
async function confirmDisconnect() {
  if (disconnectBusy.value) return
  disconnectBusy.value = true
  disconnectError.value = ''
  const result = await disconnectCalendar(currentUser.value._id)
  disconnectBusy.value = false
  if (result) {
    confirmOpen.value = false
    emit('disconnected')
  } else {
    disconnectError.value = 'Could not disconnect Google Calendar. Please try again.'
  }
}
</script>

<template>
  <div v-if="calendar.enabled" class="gcal-box">
    <!-- One status row: a coloured dot, the status text and the one button that fits the status. -->
    <div class="gcal-status" :data-testid="`${testPrefix}-status`">
      <span class="gcal-dot" :class="calendar.connected ? 'is-on' : 'is-off'" aria-hidden="true"></span>
      <template v-if="calendar.connected">
        <span class="gcal-text text-break">Synced with <strong>{{ calendar.email }}</strong></span>
        <button v-if="!confirmOpen" type="button" class="btn btn-act-outline" @click="askDisconnect" :data-testid="`${testPrefix}-disconnect`">Disconnect</button>
      </template>
      <template v-else>
        <span class="gcal-text">Not connected to Google Calendar</span>
        <button type="button" class="btn btn-act-primary" :disabled="connectBusy" @click="openConnect" :data-testid="`${testPrefix}-connect`">Connect Google Calendar</button>
      </template>
    </div>

    <!-- Password check (email/password accounts only). The input starts empty. -->
    <div v-if="!calendar.connected && passwordOpen" class="gcal-panel gcal-password" :data-testid="`${testPrefix}-password-box`">
      <label :for="`${testPrefix}-password-input`" class="gcal-label">Enter your Homly Hauls password to connect Google Calendar</label>
      <input :id="`${testPrefix}-password-input`" type="password" autocomplete="current-password" class="form-control" v-model="password" :disabled="connectBusy" :data-testid="`${testPrefix}-password`" />
      <p v-if="connectError" class="gcal-error" role="alert" :data-testid="`${testPrefix}-connect-error`">{{ connectError }}</p>
      <div class="gcal-actions">
        <button type="button" class="btn btn-act-primary" :disabled="connectBusy || !password" @click="submitConnect" :data-testid="`${testPrefix}-password-continue`">Continue</button>
        <button type="button" class="btn btn-act-outline" :disabled="connectBusy" @click="cancelConnect" :data-testid="`${testPrefix}-password-cancel`">Cancel</button>
      </div>
    </div>
    <!-- Google sign-up accounts have no password box, so their error shows on its own line. -->
    <p v-else-if="!calendar.connected && connectError" class="gcal-error" role="alert" :data-testid="`${testPrefix}-connect-error`">{{ connectError }}</p>

    <!-- Disconnect question. Events already in Google stay there; the server stops updating them. -->
    <div v-if="calendar.connected && confirmOpen" class="gcal-panel gcal-confirm" :data-testid="`${testPrefix}-disconnect-confirm`">
      <p class="gcal-question">Disconnect Google Calendar?</p>
      <p class="gcal-note">Pickups already in your Google Calendar stay there but won't be updated. New accepted orders won't be added.</p>
      <div class="gcal-actions">
        <button type="button" class="btn btn-act-danger" :disabled="disconnectBusy" @click="confirmDisconnect" :data-testid="`${testPrefix}-disconnect-yes`">{{ disconnectBusy ? 'Please wait…' : 'Yes, disconnect' }}</button>
        <button type="button" class="btn btn-act-outline" :disabled="disconnectBusy" @click="keepConnected" :data-testid="`${testPrefix}-disconnect-no`">Keep connected</button>
      </div>
      <p v-if="disconnectError" class="gcal-error" role="alert" :data-testid="`${testPrefix}-disconnect-error`">{{ disconnectError }}</p>
    </div>
  </div>
</template>

<style scoped>
/* Status row: wraps on phones so the button drops under the text instead of making the page scroll sideways. */
.gcal-status { display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem 0.75rem; }
.gcal-dot { width: 9px; height: 9px; flex-shrink: 0; border-radius: 50%; }
.gcal-dot.is-on { background: #23804a; }
.gcal-dot.is-off { background: #b9bfd6; }
.gcal-text { min-width: 0; font-size: 13.5px; color: #4b4f72; }
.gcal-text strong { color: #1f2140; }

/* Password box and disconnect question sit under the status row. */
.gcal-panel { max-width: 440px; margin-top: 0.75rem; }
.gcal-confirm { padding-top: 0.75rem; border-top: 1px solid #dfe3f2; }
.gcal-label { display: block; margin-bottom: 0.4rem; font-size: 13.5px; font-weight: 600; color: #1f2140; }
.gcal-question { margin: 0 0 0.25rem; font-size: 14px; font-weight: 600; color: #1f2140; }
.gcal-note { margin: 0; font-size: 13px; color: #4b4f72; }
.gcal-error { margin: 0.5rem 0 0; font-size: 13.5px; color: #b8312f; }
.gcal-actions { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 0.75rem; }

/* Button set copied from CalendarView.vue / SellerOrdersView.vue ("One button set for every order screen").
   A page's scoped CSS does not reach inside this component, so the box needs its own copy. */
.btn.btn-act-primary, .btn.btn-act-outline, .btn.btn-act-danger { display: inline-flex; align-items: center; justify-content: center; gap: 0.3rem; border: 1.5px solid; border-radius: 999px; min-height: 30px; padding: 0 10px; font-size: 12px; font-weight: 600; line-height: 1.2; }
.btn.btn-act-primary { background: var(--ocean); border-color: var(--ocean); color: #fff; }
.btn.btn-act-outline { background: #fff; border-color: #c9d0f6; color: #2e3170; }
.btn.btn-act-danger { background: #fff; border-color: #f0b9bb; color: #c43c41; }
.btn.btn-act-primary:hover, .btn.btn-act-outline:hover { background: #e9ecfc; border-color: #4d63ff; color: #2e3170; }
.btn.btn-act-danger:hover { background: #fff3f4; border-color: #e5484d; color: #c43c41; }
.btn.btn-act-primary:focus-visible, .btn.btn-act-outline:focus-visible, .btn.btn-act-danger:focus-visible { outline: 2px solid #4d63ff; outline-offset: 2px; }
.btn.btn-act-primary:disabled, .btn.btn-act-outline:disabled, .btn.btn-act-danger:disabled { opacity: .6; }
</style>
