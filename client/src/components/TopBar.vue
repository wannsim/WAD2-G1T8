<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import axios from 'axios'
import { API_URL } from '@/utils/config'
import { socket } from '@/utils/socket'
import { currentUser, isLoggedIn, isSeller, clearUser } from '@/utils/auth'
import { navOpen, recentOrders, loadRecentOrders } from '@/utils/layout'
import NotificationBell from './NotificationBell.vue'

// Owner: Cheyenne (chat badge + user menu moved here from Wan Sim's NavBar)
// Top bar of the app frame, like the BuyMore inspiration:
//   left: "12 Orders / last 7 days"   right: followed shops, bell, chats, the user's avatar + menu
const router = useRouter()
const route = useRoute()

function logout() {
  clearUser()
  router.push('/login')
}

// ---- unread chat messages (red badge on the chat button) ----
const unread = ref(0)
async function loadUnread() {
  if (!currentUser.value) {
    unread.value = 0
    return
  }
  try {
    const response = await axios.get(`${API_URL}/chats/unread/${currentUser.value._id}`)
    unread.value = response.data.unread
  } catch (error) {
    // server might be off: ignore
  }
}

// ---- shops the buyer follows (little avatar stack, like the inspiration's "+8") ----
const followed = ref([])
async function loadFollowed() {
  if (!currentUser.value || isSeller.value) {
    followed.value = []
    return
  }
  try {
    const response = await axios.get(`${API_URL}/shops/following/${currentUser.value._id}`)
    followed.value = response.data
  } catch (error) {
    followed.value = []
  }
}

// shortcuts in the user menu: buyers and sellers get different ones
const shortcuts = computed(() => (isSeller.value
  ? [{ to: '/seller/products', label: 'Add a product' }, { to: '/profile', label: 'Edit my profile' }]
  : [{ to: '/profile', label: 'Edit my interests' }, { to: '/map', label: 'Find shops near me' }]))

// the number on the left: something the user can act on, in plain words
//   buyers:  orders still going (waiting / accepted / new time proposed)
//   sellers: orders waiting for the seller's answer
const ACTIVE = ['pending', 'accepted', 'rescheduled']
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`
const orderStat = computed(() => {
  const orders = recentOrders.value
  if (isSeller.value) {
    const waiting = orders.filter((o) => o.status === 'pending').length
    return waiting
      ? { number: waiting, title: `${waiting === 1 ? 'Order needs' : 'Orders need'} your reply`, hint: 'Open shop orders ›', to: '/seller/orders', alert: true }
      : { number: 0, title: 'All caught up', hint: 'No orders waiting for a reply', to: '/seller/orders' }
  }
  const active = orders.filter((o) => ACTIVE.includes(o.status))
  const toAnswer = active.filter((o) => o.status === 'rescheduled').length
  if (!active.length) return { number: 0, title: 'No active orders', hint: 'Browse to find something ›', to: '/browse' }
  return {
    number: active.length,
    title: active.length === 1 ? 'Active order' : 'Active orders',
    hint: toAnswer ? `${plural(toAnswer, 'new time')} to accept ›` : 'Track my orders ›',
    to: '/orders',
    alert: toAnswer > 0,
  }
})
const initial = computed(() => (currentUser.value?.name || '?').charAt(0).toUpperCase())

function refreshAll() {
  loadUnread()
  loadFollowed()
}
watch(currentUser, refreshAll)
watch(() => route.path, () => {
  if (route.path === '/orders' || route.path === '/seller/orders') loadRecentOrders() // keep the count fresh
})

onMounted(() => {
  refreshAll()
  socket.on('new-message', loadUnread)
  socket.on('unread-changed', loadUnread)
  socket.on('connect', loadUnread) // reconnected (e.g. server restarted): catch up on missed messages
  socket.on('notification', loadRecentOrders) // new order / order update
  window.addEventListener('focus', loadUnread) // came back to this tab
})
onUnmounted(() => {
  socket.off('new-message', loadUnread)
  socket.off('unread-changed', loadUnread)
  socket.off('connect', loadUnread)
  socket.off('notification', loadRecentOrders)
  window.removeEventListener('focus', loadUnread)
})
</script>

<template>
  <header class="top-bar">
    <!-- phones / tablets: menu button + logo -->
    <button type="button" class="icon-btn menu-btn" aria-label="Open menu" :aria-expanded="navOpen" @click="navOpen = true">
      <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
        <path fill-rule="evenodd" d="M2.5 12a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5m0-4a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5m0-4a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5" />
      </svg>
    </button>
    <RouterLink to="/home" class="mobile-brand">Homly Hauls</RouterLink>

    <!-- big number + label -->
    <RouterLink v-if="isLoggedIn" :to="orderStat.to" class="stat" data-testid="order-stat">
      <span class="stat-number" :class="{ alert: orderStat.alert }">{{ orderStat.number }}</span>
      <span class="stat-label">
        <span>{{ orderStat.title }}</span>
        <small :class="{ 'text-alert': orderStat.alert }">{{ orderStat.hint }}</small>
      </span>
    </RouterLink>
    <p v-else class="stat-guest mb-0">Homemade food, crafts and services from your neighbours</p>

    <div class="right">
      <template v-if="isLoggedIn">
        <!-- followed shops -->
        <RouterLink v-if="followed.length" to="/home?tab=following" class="avatar-stack" data-testid="following-stack"
          :title="`Shops you follow: ${followed.map((s) => s.name).join(', ')}`">
          <span class="stack">
            <span v-for="shop in followed.slice(0, 3)" :key="shop._id" class="mini-avatar">{{ shop.name.charAt(0).toUpperCase() }}</span>
            <span v-if="followed.length > 3" class="more">+{{ followed.length - 3 }}</span>
          </span>
          <span class="stack-label">
            <span>Following</span>
            <small>{{ plural(followed.length, 'shop') }}</small>
          </span>
        </RouterLink>
        <NotificationBell class="top-bell" />
        <RouterLink to="/chats" class="pill-btn" title="Chats">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
          </svg>
          <span class="d-none d-sm-inline">Chats</span>
          <span v-if="unread > 0" class="badge rounded-pill bg-danger">{{ unread > 9 ? '9+' : unread }}</span>
        </RouterLink>

        <div class="dropdown">
          <button class="user-btn" type="button" data-bs-toggle="dropdown" aria-expanded="false">
            <span class="user-avatar" aria-hidden="true">{{ initial }}</span>
            <span class="user-name d-none d-md-inline">{{ currentUser.name }}</span>
          </button>
          <ul class="dropdown-menu dropdown-menu-end">
            <li><RouterLink class="dropdown-item" to="/profile">Profile</RouterLink></li>
            <li><RouterLink class="dropdown-item" to="/notifications">Notifications</RouterLink></li>
            <!-- shortcuts (were "Quick actions" in the sidebar) -->
            <li><hr class="dropdown-divider" /></li>
            <li v-for="a in shortcuts" :key="a.label"><RouterLink class="dropdown-item" :to="a.to">{{ a.label }}</RouterLink></li>
            <li><hr class="dropdown-divider" /></li>
            <li><button class="dropdown-item" type="button" @click="logout">Log out</button></li>
          </ul>
        </div>
      </template>
      <template v-else>
        <RouterLink to="/register" class="pill-btn d-none d-sm-inline-flex">Create an account</RouterLink>
        <RouterLink to="/login" class="btn btn-brand">Log in</RouterLink>
      </template>
    </div>
  </header>
</template>

<style scoped>
/* above the page, so the bell / user pop-ups are never hidden behind cards */
.top-bar {
  position: relative;
  z-index: 1030;
  display: flex;
  align-items: center;
  gap: 1rem;
  min-height: 84px;
  padding: 0.9rem 2rem;
}
.stat {
  display: inline-flex;
  align-items: center;
  gap: 0.7rem;
  color: var(--navy);
  text-decoration: none;
}
.stat-number {
  font-size: 2.1rem;
  font-weight: 400;
  line-height: 1;
}
.stat-label {
  display: flex;
  flex-direction: column;
  font-size: 0.9rem;
  line-height: 1.2;
}
.stat-label small {
  color: var(--muted);
}
.stat:hover .stat-label small {
  color: var(--ocean-dark);
}
/* something needs the user's answer: amber number + hint */
.stat-number.alert {
  color: #c27c0e;
}
.stat-label small.text-alert {
  color: #b7801a;
  font-weight: 500;
}
.stat-guest {
  font-size: 0.9rem;
  color: var(--muted);
}
.right {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  margin-left: auto;
}

/* grey pill buttons (like "Cart" in the inspiration) */
.pill-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  height: 44px;
  padding: 0 1.1rem;
  border-radius: 1rem;
  background: var(--tile);
  font-size: 0.92rem;
  color: var(--ink);
  text-decoration: none;
  white-space: nowrap;
}
.pill-btn:hover,
.pill-btn.router-link-active {
  background: var(--tile-hover);
  color: var(--navy);
}
.icon-btn {
  display: inline-grid;
  place-items: center;
  width: 44px;
  height: 44px;
  flex-shrink: 0;
  border: 0;
  border-radius: 1rem;
  background: var(--tile);
  color: var(--ink);
}
/* the bell keeps its own logic; here it just gets the grey square look */
.top-bell :deep(.bell-btn) {
  width: 44px;
  height: 44px;
  justify-content: center;
  padding: 0;
  border-radius: 1rem;
  background: var(--tile);
}
.top-bell :deep(.bell-btn:hover),
.top-bell :deep(.bell-btn.active) {
  background: var(--tile-hover);
  color: var(--navy);
}
.top-bell :deep(.bell-btn .badge) {
  position: absolute;
  top: 4px;
  right: 2px;
  margin: 0 !important;
  font-size: 0.65rem;
}
.top-bell :deep(.bell-btn .d-xl-none) {
  display: none !important; /* the word "Notifications" is not needed in the top bar */
}
.top-bell :deep(.popup) {
  right: 0;
  left: auto;
}

.avatar-stack {
  display: inline-flex;
  align-items: center;
  gap: 0.55rem;
  padding: 0.3rem 0.8rem 0.3rem 0.3rem;
  border-radius: 999px;
  text-decoration: none;
}
.avatar-stack:hover {
  background: var(--tile);
}
.mini-avatar {
  display: inline-grid;
  place-items: center;
  width: 30px;
  height: 30px;
  margin-left: -8px;
  border: 2px solid var(--surface);
  border-radius: 50%;
  background: linear-gradient(135deg, var(--ocean), var(--aqua));
  font-size: 0.75rem;
  font-weight: 700;
  color: #fff;
}
.mini-avatar:first-child {
  margin-left: 0;
}
.stack {
  display: inline-flex;
  align-items: center;
}
.stack-label {
  display: flex;
  flex-direction: column;
  font-size: 0.85rem;
  line-height: 1.2;
  color: var(--navy);
}
.stack-label small {
  color: var(--muted);
}
.avatar-stack .more {
  margin-left: 0.35rem;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--ink-soft);
}

.user-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.25rem 0.5rem 0.25rem 0.25rem;
  border: 0;
  border-radius: 999px;
  background: none;
  color: var(--navy);
}
.user-btn:hover {
  background: var(--tile);
}
.user-avatar {
  display: inline-grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: linear-gradient(135deg, #fbeeb0, #f8c9b8);
  font-weight: 700;
  color: var(--navy);
}
.user-name {
  max-width: 140px;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.menu-btn,
.mobile-brand {
  display: none;
}
@media (max-width: 991.98px) {
  .top-bar {
    padding: 0.75rem 1rem;
    gap: 0.6rem;
  }
  .menu-btn {
    display: inline-grid;
  }
  .mobile-brand {
    display: inline;
    font-weight: 700;
    color: var(--navy);
    text-decoration: none;
    white-space: nowrap;
  }
  .stat,
  .stat-guest,
  .avatar-stack {
    display: none;
  }
}
@media (max-width: 420px) {
  .mobile-brand {
    font-size: 0.95rem;
  }
  .right {
    gap: 0.35rem;
  }
}
</style>
