
<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import axios from 'axios'
import { API_URL } from '@/utils/config'
import { currentUser, isSeller } from '@/utils/auth'
import { socket } from '@/utils/socket'
 
// Save as: client/src/views/chat/ChatView.vue
// /chats        -> chat list (pick a chat on the left)
// /chats/:id    -> same page, with that chat already opened (used by "Chat with seller")
// New messages arrive instantly through Socket.IO (the server pushes a 'new-message' event).
const route = useRoute()
const router = useRouter()
 
const conversations = ref([])
const activeId = ref(route.params.id || null) // which chat is open
const activeTitle = ref('')
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

const chatItems = computed(() => {
  const items = []
  let lastDay = ''
  messages.value.forEach((m) => {
    const day = dayKey(m.createdAt)
    if (day !== lastDay) {
      items.push({ id: 'date-' + day, type: 'date', label: dayLabel(m.createdAt) })
      lastDay = day
    }
    items.push({ id: m._id, type: 'message', message: m })
  })
  return items
})

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
 
onMounted(async () => {
  if (!currentUser.value) {
    router.push('/login')
    return
  }
  await loadConversations()
  await loadMessages()
  socket.on('new-message', onNewMessage)
  socket.on('connect', refresh)
})
 
onUnmounted(() => {
  socket.off('new-message', onNewMessage) // stop listening when we leave the page
  socket.off('connect', refresh)
})
</script>
 
<template>
  <div>
    <div class="d-block align-items-center gap-3 mb-3">
      <button class="btn btn-sm d-flex align-items-center gap-1" @click="goBack">
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
        <p v-if="conversations.length === 0" class="text-muted">
          No chats yet. Open a product and tap "Chat with seller".
        </p>
        <div v-else class="search-box mb-2">
          <svg class="search-icon" width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
            <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001q.044.06.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1 1 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0" />
          </svg>
          <input type="search" class="form-control" v-model="nameSearch"
            :placeholder="isSeller ? 'Search by buyer name...' : 'Search by shop name...'" aria-label="Search chats by name" />
        </div>
        <p v-if="conversations.length > 0 && shownConversations.length === 0" class="text-muted small">
          No chats match "{{ nameSearch }}".
        </p>
        <div class="list-group">
          <button
            v-for="c in shownConversations"
            :key="c._id"
            type="button"
            class="list-group-item list-group-item-action"
            :class="{ 'chat-active': c._id === activeId }"
            @click="selectChat(c)"
          >
            <div class="d-flex justify-content-between align-items-center">
              <strong>{{ c.title }}</strong>
              <span v-if="c.unread > 0" class="badge rounded-pill bg-danger">{{ c.unread }}</span>
            </div>
            <div class="small text-muted text-truncate">{{ c.lastMessage || 'No messages yet' }}</div>
          </button>
        </div>
      </div>
 
      <!-- right: the open chat (hidden on phones until a chat is picked) -->
      <div class="col-md-8" :class="{ 'd-none d-md-block': !activeId }">
        <div v-if="activeId" class="card">
          <div class="card-header bg-white d-flex align-items-center gap-2">
            <button class="btn btn-sm btn-outline-secondary d-md-none" @click="closeMessageSearch(); activeId = null">All chats</button>
            <strong>{{ activeTitle }}</strong>
            <button type="button" class="btn btn-sm ms-auto icon-btn" :class="messageSearchOpen ? 'btn-secondary' : 'btn-outline-secondary'"
              :data-label="messageSearchOpen ? null : 'Search messages'" aria-label="Search messages"
              @click="messageSearchOpen ? closeMessageSearch() : openMessageSearch()">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001q.044.06.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1 1 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0" />
              </svg>
            </button>
          </div>

          <!-- search inside this chat -->
          <div v-if="messageSearchOpen" class="d-flex align-items-center gap-2 px-3 py-2 border-bottom bg-white">
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
 
          <div id="chat-box" class="chat-box p-3">
            <p v-if="messages.length === 0" class="text-muted text-center mt-4">Say hi 👋</p>
            <template v-for="item in chatItems" :key="item.id">
              <div v-if="item.type === 'date'" class="text-center my-3">
                <span class="date-pill">{{ item.label }}</span>
              </div>

              <div
                v-else
                :id="`msg-${item.message._id}`"
                class="d-flex mb-2"
                :class="item.message.sender === currentUser._id ? 'justify-content-end' : 'justify-content-start'"
              >
                <div class="bubble" :class="[item.message.sender === currentUser._id ? 'mine' : 'theirs', { 'current-match': item.message._id === currentMatchId }]">
                  <div>
                    <template v-for="(part, i) in highlightParts(item.message.text)" :key="i">
                      <mark v-if="part.match" class="hit">{{ part.text }}</mark><template v-else>{{ part.text }}</template>
                    </template>
                  </div>
                  <div class="time">{{ formatTime(item.message.createdAt) }}</div>
                </div>
              </div>
            </template>
          </div>
 
          <div class="card-footer bg-white d-flex gap-2">
            <input
              type="text"
              class="form-control"
              placeholder="Type a message..."
              maxlength="1000"
              v-model="newText"
              @keyup.enter="send"
            />
            <button class="btn btn-brand" @click="send">Send</button>
          </div>
        </div>
 
        <p v-else class="text-muted text-center pt-5">Select a chat to start messaging</p>
      </div>
    </div>
  </div>
</template>
 
<style scoped>
.chat-box {
  height: 55vh;
  overflow-y: auto;
  background: var(--surface-soft);
}
.bubble {
  max-width: 75%;
  padding: 0.5rem 0.75rem;
  border-radius: 1rem;
  word-break: break-word;
}
.mine {
  background: var(--brand);
  color: #fff;
  border-bottom-right-radius: 0.25rem;
}
.theirs {
  background: #fff;
  border: 1px solid var(--line);
  border-bottom-left-radius: 0.25rem;
}
.time {
  font-size: 0.7rem;
  opacity: 0.7;
  text-align: right;
}
.chat-active {
  background: rgba(var(--brand-rgb), 0.1);
}
.search-box {
  position: relative;
}
.search-icon {
  position: absolute;
  top: 50%;
  left: 0.75rem;
  transform: translateY(-50%);
  color: var(--muted);
  pointer-events: none;
}
.search-box .form-control {
  padding-left: 2rem;
}
.match-count {
  min-width: 4.5rem;
  text-align: center;
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
.icon-btn {
  position: relative;
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
.date-pill {
  display: inline-block;
  padding: 0.2rem 0.8rem;
  border-radius: 1rem;
  background: var(--aqua-soft);
  color: var(--ink-soft);
  font-size: 0.8rem;
  font-weight: 600;
}
</style>