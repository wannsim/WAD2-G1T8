
<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import axios from 'axios'
import { API_URL } from '@/utils/config'
import { currentUser, isSeller } from '@/utils/auth'
import { socket } from '@/utils/socket'
import { chatAvatarUrl, myShopAvatar, userAvatarUrl } from '@/utils/layout'
import { lastSeenLabel, formatPrice } from '@/utils/format'
import AvatarEditor from '@/components/AvatarEditor.vue'
 
// Save as: client/src/views/chat/ChatView.vue
// /chats        -> chat list (pick a chat on the left)
// /chats/:id    -> same page, with that chat already opened (used by "Chat with seller")
// /chats/:id?product=<productId> -> also shows that product at the top of the chat (from the product page)
// New messages arrive instantly through Socket.IO (the server pushes a 'new-message' event).
const route = useRoute()
const router = useRouter()
 
const conversations = ref([])
const activeId = ref(route.params.id || null) // which chat is open
const activeTitle = ref('')
const activePeer = ref(null) // the other person in the open chat: { avatar, lastSeenAt } (from /chats/:id/messages)
const peerUnread = ref(0) // how many of my latest messages they haven't read yet (one tick instead of two)
const messages = ref([])
const newText = ref('')
const error = ref('')
 
async function loadConversations() {
  try {
    const response = await axios.get(`${API_URL}/chats/user/${currentUser.value._id}`)
    conversations.value = response.data
  } catch (err) {
    console.log(err.message)
  }
}
 
async function loadMessages() {
  if (!activeId.value) return
  try {
    const response = await axios.get(`${API_URL}/chats/${activeId.value}/messages`, {
      params: { userId: currentUser.value._id },
    })
    activeTitle.value = response.data.title
    activePeer.value = { avatar: response.data.avatar, lastSeenAt: response.data.lastSeenAt }
    peerUnread.value = response.data.peerUnread || 0
    // only redraw (and scroll down) when something new arrived
    if (response.data.messages.length !== messages.value.length) {
      messages.value = response.data.messages
      await nextTick() // wait for Vue to draw the new messages, then scroll
      const box = document.getElementById('chat-box')
      if (box) box.scrollTop = box.scrollHeight
    }
  } catch (err) {
    error.value = err.response?.data?.message || err.message
    activeId.value = null
  }
}
 
// ---- search 1: find a chat by name (shop name for buyers, buyer name for sellers) ----
const nameSearch = ref('')
const shownConversations = computed(() => {
  const q = nameSearch.value.trim().toLowerCase()
  return q ? conversations.value.filter((c) => (c.title || '').toLowerCase().includes(q)) : conversations.value
})

// ---- search 2: find a message inside the open chat ----
const messageSearchOpen = ref(false)
const messageSearch = ref('')
const messageSearchInput = ref(null)
const matchIndex = ref(0) // which match is selected (0 = oldest)
const matchIds = computed(() => {
  const q = messageSearch.value.trim().toLowerCase()
  return q ? messages.value.filter((m) => m.text.toLowerCase().includes(q)).map((m) => m._id) : []
})
const currentMatchId = computed(() => matchIds.value[matchIndex.value])

async function scrollToMatch() {
  await nextTick()
  const el = currentMatchId.value && document.getElementById(`msg-${currentMatchId.value}`)
  if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' })
}
// typing a new search jumps to the newest match
watch(messageSearch, () => {
  matchIndex.value = Math.max(matchIds.value.length - 1, 0)
  scrollToMatch()
})
// step = -1 older, +1 newer (wraps around)
function goToMatch(step) {
  const count = matchIds.value.length
  if (count === 0) return
  matchIndex.value = (matchIndex.value + step + count) % count
  scrollToMatch()
}
async function openMessageSearch() {
  messageSearchOpen.value = true
  await nextTick()
  messageSearchInput.value?.focus()
}
function closeMessageSearch() {
  messageSearchOpen.value = false
  messageSearch.value = ''
}

// splits a message so the searched words can be highlighted (no v-html, so messages stay plain text)
function highlightParts(text) {
  const q = messageSearch.value.trim()
  if (!q) return [{ text, match: false }]
  const parts = []
  const lower = text.toLowerCase()
  const needle = q.toLowerCase()
  let start = 0
  let found = lower.indexOf(needle)
  while (found !== -1) {
    if (found > start) parts.push({ text: text.slice(start, found), match: false })
    parts.push({ text: text.slice(found, found + q.length), match: true })
    start = found + q.length
    found = lower.indexOf(needle, start)
  }
  if (start < text.length) parts.push({ text: text.slice(start), match: false })
  return parts
}

async function selectChat(conversation) {
  error.value = ''
  closeMessageSearch()
  activeId.value = conversation._id
  messages.value = []
  await loadMessages()
  loadConversations() // refresh the unread badges
}
 
async function send() {
  const text = newText.value.trim()
  if (!text || !activeId.value) return
  try {
    await axios.post(`${API_URL}/chats/${activeId.value}/messages`, {
      sender: currentUser.value._id,
      text: text,
    })
    newText.value = ''
    await loadMessages()
    loadConversations()
  } catch (err) {
    error.value = err.response?.data?.message || err.message
  }
}

function dayKey(date) {
  return new Date(date).toLocaleDateString('en-CA', { timeZone: 'Asia/Singapore' })
}

function dayLabel(date) {
  const key = dayKey(date)
  const today = dayKey(new Date())
  const yesterday = dayKey(new Date(Date.now() - 24 * 60 * 60 * 1000))
  if (key === today) return 'Today'
  if (key === yesterday) return 'Yesterday'
  const options = { month: 'long', day: 'numeric', timeZone: 'Asia/Singapore' }
  if (key.slice(0, 4) !== today.slice(0, 4)) options.year = 'numeric'
  return new Date(date).toLocaleDateString('en-US', options)
}

// my messages they haven't read yet = the last `peerUnread` of mine (shown with one tick, the rest with two)
const unreadIds = computed(() => {
  const mine = messages.value.filter((m) => m.sender === currentUser.value._id)
  return new Set(peerUnread.value > 0 ? mine.slice(-peerUnread.value).map((m) => m._id) : [])
})

const chatItems = computed(() => {
  const items = []
  let lastDay = ''
  let lastSender = ''
  messages.value.forEach((m) => {
    const day = dayKey(m.createdAt)
    if (day !== lastDay) {
      items.push({ id: 'date-' + day, type: 'date', label: dayLabel(m.createdAt) })
      lastDay = day
      lastSender = ''
    }
    // the picture shows once, next to the first message of each run from the same person
    items.push({ id: m._id, type: 'message', message: m, mine: m.sender === currentUser.value._id, firstInRun: m.sender !== lastSender })
    lastSender = m.sender
  })
  return items
})

// pictures next to the messages: theirs (shop / buyer) and mine (sellers: their shop's, buyers: their own)
const myAvatarUrl = computed(() => (isSeller.value ? myShopAvatar.value : userAvatarUrl(currentUser.value)))
const myName = computed(() => currentUser.value?.name || '')

// the product the buyer came from (only when opened with ?product=, and only on that chat)
const productContext = ref(null) // { conversationId, product }
async function loadProductContext() {
  const productId = route.query.product
  if (!productId || !activeId.value) return
  try {
    const response = await axios.get(`${API_URL}/products/${productId}`)
    productContext.value = { conversationId: activeId.value, product: response.data }
  } catch (err) {
    productContext.value = null // product deleted: just don't show it
  }
}
const shownProduct = computed(() =>
  productContext.value && productContext.value.conversationId === activeId.value ? productContext.value.product : null)

function goBack() {
  if (window.history.state && window.history.state.back) {
    router.back()
  } else {
    router.push('/home')
  }
}
 
function formatTime(date) {
  return new Date(date).toLocaleTimeString('en-SG', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Singapore',
  })
}
// chat list: last message today -> its time ("02:45 pm"), any other day -> the date ("13/10/2026")
const sgDay = (date) => new Date(date).toLocaleDateString('en-SG', { timeZone: 'Asia/Singapore' })
function listTime(date) {
  if (sgDay(date) === sgDay(new Date())) return formatTime(date)
  return new Date(date).toLocaleDateString('en-SG', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Asia/Singapore' })
}

// a message was sent in one of my chats: refresh the list, and the open chat if it is that one
function onNewMessage(data) {
  loadConversations()
  if (data.conversationId === activeId.value) loadMessages()
}
 
// after reconnecting (e.g. server restarted), catch up on anything we missed
function refresh() {
  loadConversations()
  loadMessages()
}
 
// chat header: picture + "Online" / "Last seen ...". The list (re)loads every minute, so this stays current
const activeConversation = computed(() => conversations.value.find((c) => c._id === activeId.value))
const activeAvatarUrl = computed(() => chatAvatarUrl(activeConversation.value?.avatar || activePeer.value?.avatar))
// the name shows straight away from the chat list (the messages call fills it in otherwise)
const headerTitle = computed(() => activeConversation.value?.title || activeTitle.value)
const now = ref(Date.now())
const activeLastSeen = computed(() => {
  now.value // re-check every minute ("Online" -> "Last seen today at ...")
  return lastSeenLabel(activeConversation.value?.lastSeenAt || activePeer.value?.lastSeenAt)
})
let presenceTimer = null

onMounted(async () => {
  if (!currentUser.value) {
    router.push('/login')
    return
  }
  await loadConversations()
  await loadMessages()
  loadProductContext()
  socket.on('new-message', onNewMessage)
  socket.on('connect', refresh)
  presenceTimer = setInterval(() => {
    now.value = Date.now()
    loadConversations()
  }, 60 * 1000)
})
 
onUnmounted(() => {
  clearInterval(presenceTimer)
  socket.off('new-message', onNewMessage) // stop listening when we leave the page
  socket.off('connect', refresh)
})
</script>
 
<template>
  <div>
    <div class="d-block align-items-center gap-3 mb-3">
      <button class="btn btn-sm d-flex align-items-center gap-1 back-btn" @click="goBack">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-arrow-left" viewBox="0 0 16 16">
          <path fill-rule="evenodd" d="M15 8a.5.5 0 0 0-.5-.5H2.707l3.147-3.146a.5.5 0 1 0-.708-.708l-4 4a.5.5 0 0 0 0 .708l4 4a.5.5 0 0 0 .708-.708L2.707 8.5H14.5A.5.5 0 0 0 15 8" />
        </svg>
        Back
      </button>
      <h2 class="page-title ms-1 mb-0">Chats</h2>
    </div>
    <div v-if="error" class="alert alert-danger py-2 small">{{ error }}</div>

    <div class="row g-3">
      <!-- left: chat list (hidden on phones while a chat is open) -->
      <div class="col-md-4" :class="{ 'd-none d-md-block': activeId }">
        <div class="chat-panel list-panel">
          <p v-if="conversations.length === 0" class="text-muted small p-2 mb-0">
            No chats yet. Open a product and tap "Chat with seller".
          </p>
          <div v-else class="search-box mb-2">
            <svg class="search-icon" width="15" height="15" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
              <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001q.044.06.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1 1 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0" />
            </svg>
            <input type="search" class="form-control" v-model="nameSearch"
              :placeholder="isSeller ? 'Search by buyer name...' : 'Search by shop name...'" aria-label="Search chats by name" />
          </div>
          <p v-if="conversations.length > 0 && shownConversations.length === 0" class="text-muted small px-2">
            No chats match "{{ nameSearch }}".
          </p>
          <button
            v-for="c in shownConversations"
            :key="c._id"
            type="button"
            class="chat-row"
            :class="{ 'chat-active': c._id === activeId }"
            @click="selectChat(c)"
          >
            <!-- buyers see the shop's picture, sellers see the buyer's -->
            <AvatarEditor :src="chatAvatarUrl(c.avatar)" :name="c.title" size="44px" />
            <div class="chat-text">
              <!-- name + when the last message was sent (time if today, otherwise the date) -->
              <div class="d-flex justify-content-between align-items-baseline gap-2">
                <strong class="chat-name text-truncate">{{ c.title }}</strong>
                <span v-if="c.lastMessageAt" class="chat-time" :class="{ unread: c.unread > 0 }">{{ listTime(c.lastMessageAt) }}</span>
              </div>
              <div class="d-flex justify-content-between align-items-center gap-2">
                <span class="chat-preview text-truncate">{{ c.lastMessage || 'No messages yet' }}</span>
                <span v-if="c.unread > 0" class="unread-count">{{ c.unread }}</span>
              </div>
            </div>
          </button>
        </div>
      </div>

      <!-- right: the open chat (hidden on phones until a chat is picked) -->
      <div class="col-md-8" :class="{ 'd-none d-md-block': !activeId }">
        <div v-if="activeId" class="chat-panel convo-panel">
          <!-- header: their picture, name, Online / Last seen; the product (if they came from a product page); search -->
          <div class="convo-header">
            <button class="btn btn-sm btn-outline-secondary d-md-none" @click="closeMessageSearch(); activeId = null">All chats</button>
            <AvatarEditor :src="activeAvatarUrl" :name="headerTitle" size="48px" />
            <div class="chat-text">
              <strong class="convo-name text-truncate">{{ headerTitle }}</strong>
              <span v-if="activeLastSeen" class="last-seen" :class="{ online: activeLastSeen === 'Online' }">{{ activeLastSeen }}</span>
            </div>
            <RouterLink v-if="shownProduct" :to="`/products/${shownProduct._id}`" class="product-strip">
              <img :src="shownProduct.imageUrl || '/placeholder.svg'" alt="" @error="$event.target.src = '/placeholder.svg'" />
              <span class="product-strip-text">
                <span class="text-truncate">{{ shownProduct.name }}</span>
                <small class="text-truncate">{{ shownProduct.shop?.name }} &middot; {{ formatPrice(shownProduct.price) }}</small>
              </span>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                <path fill-rule="evenodd" d="M4.646 1.646a.5.5 0 0 1 .708 0l6 6a.5.5 0 0 1 0 .708l-6 6a.5.5 0 0 1-.708-.708L10.293 8 4.646 2.354a.5.5 0 0 1 0-.708" />
              </svg>
            </RouterLink>
            <button type="button" class="btn btn-sm icon-btn" :class="messageSearchOpen ? 'btn-secondary' : 'btn-light'"
              :data-label="messageSearchOpen ? null : 'Search messages'" aria-label="Search messages"
              @click="messageSearchOpen ? closeMessageSearch() : openMessageSearch()">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001q.044.06.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1 1 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0" />
              </svg>
            </button>
          </div>

          <!-- search inside this chat -->
          <div v-if="messageSearchOpen" class="d-flex align-items-center gap-2 px-3 py-2 border-bottom">
            <input ref="messageSearchInput" type="search" class="form-control form-control-sm" v-model="messageSearch"
              placeholder="Search in this chat..." aria-label="Search messages in this chat"
              @keydown.enter.prevent="goToMatch($event.shiftKey ? 1 : -1)" @keydown.esc="closeMessageSearch" />
            <span class="small text-muted text-nowrap match-count">
              {{ messageSearch.trim() ? (matchIds.length ? `${matchIndex + 1} of ${matchIds.length}` : 'No results') : '' }}
            </span>
            <button type="button" class="btn btn-sm btn-outline-secondary" :disabled="matchIds.length < 2"
              aria-label="Older match" title="Older match" @click="goToMatch(-1)">&uarr;</button>
            <button type="button" class="btn btn-sm btn-outline-secondary" :disabled="matchIds.length < 2"
              aria-label="Newer match" title="Newer match" @click="goToMatch(1)">&darr;</button>
            <button type="button" class="btn-close" aria-label="Close search" @click="closeMessageSearch"></button>
          </div>

          <div id="chat-box" class="chat-box">
            <p v-if="messages.length === 0" class="text-muted text-center mt-4">Say hi 👋</p>
            <template v-for="item in chatItems" :key="item.id">
              <div v-if="item.type === 'date'" class="text-center my-3">
                <span class="date-pill">{{ item.label }}</span>
              </div>

              <!-- picture | bubble (theirs), bubble | picture (mine); the picture shows on the first of a run -->
              <div v-else :id="`msg-${item.message._id}`" class="msg-row" :class="{ 'from-me': item.mine, 'run-start': item.firstInRun }">
                <div class="msg-avatar">
                  <AvatarEditor v-if="item.firstInRun" :src="item.mine ? myAvatarUrl : activeAvatarUrl"
                    :name="item.mine ? myName : headerTitle" size="30px" />
                </div>
                <div class="bubble" :class="[item.mine ? 'mine' : 'theirs', { 'current-match': item.message._id === currentMatchId }]">
                  <div>
                    <template v-for="(part, i) in highlightParts(item.message.text)" :key="i">
                      <mark v-if="part.match" class="hit">{{ part.text }}</mark><template v-else>{{ part.text }}</template>
                    </template>
                  </div>
                  <div class="time">
                    {{ formatTime(item.message.createdAt) }}
                    <!-- my messages: ✓ = sent, ✓✓ = they've read it -->
                    <span v-if="item.mine" class="ticks" :title="unreadIds.has(item.message._id) ? 'Sent' : 'Read'">
                      {{ unreadIds.has(item.message._id) ? '✓' : '✓✓' }}
                    </span>
                  </div>
                </div>
              </div>
            </template>
          </div>

          <!-- type + send (no attachments) -->
          <div class="convo-footer">
            <input
              type="text"
              class="form-control"
              placeholder="Type a message..."
              maxlength="1000"
              v-model="newText"
              @keyup.enter="send"
            />
            <button class="btn btn-brand send-btn" @click="send">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                <path d="M15.854.146a.5.5 0 0 1 .11.54l-5.819 14.547a.75.75 0 0 1-1.329.124l-3.178-4.995L.643 7.184a.75.75 0 0 1 .124-1.33L15.314.037a.5.5 0 0 1 .54.11ZM6.636 10.07l2.761 4.338L14.13 2.576zm6.787-8.201L1.591 6.602l4.339 2.76z" />
              </svg>
              Send
            </button>
          </div>
        </div>

        <div v-else class="chat-panel convo-panel empty-convo">
          <p class="text-muted mb-0">Select a chat to start messaging</p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ---------- the two white panels ---------- */
.chat-panel {
  border: 1px solid var(--line);
  border-radius: 1.25rem;
  background: var(--surface);
}
.list-panel {
  height: calc(48vh + 150px);
  padding: 0.75rem;
  overflow-y: auto;
}
.convo-panel {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.empty-convo {
  height: calc(48vh + 150px);
  align-items: center;
  justify-content: center;
}
.back-btn {
  color: var(--ink-soft);
}

/* ---------- chat list ---------- */
.search-box {
  position: relative;
}
.search-icon {
  position: absolute;
  top: 50%;
  left: 0.85rem;
  transform: translateY(-50%);
  color: var(--muted);
  pointer-events: none;
}
.search-box .form-control {
  padding: 0.5rem 0.85rem 0.5rem 2.2rem;
  border-radius: 0.8rem;
  font-size: 0.875rem;
}
.chat-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
  margin-bottom: 0.25rem;
  padding: 0.65rem 0.75rem;
  border: 0;
  border-radius: 0.9rem;
  background: none;
  text-align: left;
  color: var(--ink);
}
.chat-row:hover {
  background: var(--surface-hover);
}
.chat-row.chat-active {
  background: var(--ocean-soft);
}
.chat-text {
  flex: 1;
  min-width: 0;
}
.chat-name {
  min-width: 0;
  font-size: 0.92rem;
}
.chat-time {
  flex-shrink: 0;
  font-size: 0.72rem;
  color: var(--muted);
}
.chat-time.unread {
  font-weight: 600;
  color: var(--ocean);
}
.chat-preview {
  min-width: 0;
  font-size: 0.8rem;
  color: var(--muted);
}
.unread-count {
  flex-shrink: 0;
  display: inline-grid;
  place-items: center;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  border-radius: 999px;
  background: var(--ocean);
  font-size: 0.7rem;
  font-weight: 700;
  color: #fff;
}

/* ---------- conversation header ---------- */
.convo-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.85rem 1rem;
  border-bottom: 1px solid var(--line);
}
.convo-name {
  display: block;
  font-size: 1.05rem;
}
.last-seen {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.78rem;
  color: var(--muted);
}
.last-seen.online {
  font-weight: 600;
  color: #2e9e5b; /* green, like the Accepted status */
}
.last-seen.online::before {
  content: '';
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: currentColor;
}
/* the product the buyer came from (top right) */
.product-strip {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  max-width: 300px;
  min-width: 0;
  padding: 0.35rem 0.5rem 0.35rem 0.85rem;
  border-left: 1px solid var(--line);
  color: var(--ink-soft);
  text-decoration: none;
}
.product-strip:hover {
  color: var(--ocean);
}
.product-strip img {
  flex-shrink: 0;
  width: 44px;
  height: 44px;
  border-radius: 0.6rem;
  object-fit: cover;
}
.product-strip-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
  font-size: 0.82rem;
  line-height: 1.3;
}
.product-strip-text small {
  color: var(--muted);
}
.icon-btn {
  position: relative;
  flex-shrink: 0;
  margin-left: auto;
}
.product-strip + .icon-btn {
  margin-left: 0;
}
/* "Search messages" label under the icon on hover */
.icon-btn[data-label]:hover::after,
.icon-btn[data-label]:focus-visible::after {
  content: attr(data-label);
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  padding: 2px 8px;
  border-radius: 4px;
  background: var(--navy);
  color: #fff;
  font-size: 0.75rem;
  white-space: nowrap;
  pointer-events: none;
  z-index: 10;
}
.match-count {
  min-width: 4.5rem;
  text-align: center;
}

/* ---------- messages ---------- */
.chat-box {
  height: 48vh;
  overflow-y: auto;
  padding: 0.75rem 1rem;
  font-size: 0.875rem;
}
.msg-row {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  margin-bottom: 0.3rem;
}
.msg-row.run-start {
  margin-top: 0.6rem;
}
.msg-row.from-me {
  flex-direction: row-reverse;
}
.msg-avatar {
  flex: 0 0 30px;
}
.bubble {
  max-width: 70%;
  padding: 0.5rem 0.85rem;
  border-radius: 1rem;
  word-break: break-word;
}
.mine {
  background: var(--ocean);
  color: #fff;
}
.theirs {
  background: var(--tile);
  color: var(--ink);
}
.run-start .bubble.mine {
  border-top-right-radius: 0.3rem;
}
.run-start .bubble.theirs {
  border-top-left-radius: 0.3rem;
}
.time {
  margin-top: 0.15rem;
  font-size: 0.7rem;
  opacity: 0.75;
  text-align: right;
}
.ticks {
  margin-left: 0.25rem;
  letter-spacing: -0.15em;
}
.date-pill {
  display: inline-block;
  padding: 0.2rem 0.8rem;
  border-radius: 1rem;
  background: var(--aqua-soft);
  color: var(--ink-soft);
  font-size: 0.78rem;
  font-weight: 600;
}
/* searched words inside a message */
.hit {
  padding: 0 1px;
  border-radius: 3px;
  background: var(--ocean-soft);
  color: var(--ink);
}
/* the match the arrows are on */
.current-match {
  box-shadow: 0 0 0 3px var(--aqua);
}
.current-match .hit {
  background: var(--aqua);
}

/* ---------- type + send ---------- */
.convo-footer {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.75rem 1rem;
  border-top: 1px solid var(--line);
}
.convo-footer .form-control {
  padding: 0.55rem 1rem;
  border-radius: 999px;
  font-size: 0.875rem;
}
.send-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.55rem 1.2rem;
  border-radius: 999px;
  font-weight: 600;
}

/* phones: no product strip (not enough room) */
@media (max-width: 767.98px) {
  .product-strip {
    display: none;
  }
}
</style>
