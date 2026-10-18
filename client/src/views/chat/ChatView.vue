
<script setup>
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import axios from 'axios'
import { API_URL } from '@/utils/config'
import { currentUser } from '@/utils/auth'
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
 
async function selectChat(conversation) {
  error.value = ''
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
      <h2 class="ms-1 mb-0">Chats</h2>
    </div>
    <div v-if="error" class="alert alert-danger py-2 small">{{ error }}</div>
 
    <div class="row g-3">
      <!-- left: chat list (hidden on phones while a chat is open) -->
      <div class="col-md-4" :class="{ 'd-none d-md-block': activeId }">
        <p v-if="conversations.length === 0" class="text-muted">
          No chats yet. Open a product and tap "Chat with seller".
        </p>
        <div class="list-group">
          <button
            v-for="c in conversations"
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
            <button class="btn btn-sm btn-outline-secondary d-md-none" @click="activeId = null">All Chats</button>
            <strong>{{ activeTitle }}</strong>
          </div>
 
          <div id="chat-box" class="chat-box p-3">
            <p v-if="messages.length === 0" class="text-muted text-center mt-4">Say hi 👋</p>
            <div
              v-for="m in messages"
              :key="m._id"
              class="d-flex mb-2"
              :class="m.sender === currentUser._id ? 'justify-content-end' : 'justify-content-start'"
            >
              <div class="bubble" :class="m.sender === currentUser._id ? 'mine' : 'theirs'">
                <div>{{ m.text }}</div>
                <div class="time">{{ formatTime(m.createdAt) }}</div>
              </div>
            </div>
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
  background: #faf8f4;
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
  border: 1px solid #e5dfd3;
  border-bottom-left-radius: 0.25rem;
}
.time {
  font-size: 0.7rem;
  opacity: 0.7;
  text-align: right;
}
.chat-active {
  background: rgba(194, 65, 12, 0.1);
}
</style>