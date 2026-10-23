<script setup>
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'
import { API_URL } from '@/utils/config'
import { socket } from '@/utils/socket'
import { currentUser, isLoggedIn, isSeller, clearUser } from '@/utils/auth'
import NotificationBell from './NotificationBell.vue'

// Owner: Wan Sim
const router = useRouter()

function logout() {
  clearUser()
  router.push('/login')
}

// ---- unread chat messages (red badge on the chat icon) ----
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

watch(currentUser, loadUnread) // runs again after login / logout

onMounted(() => {
  loadUnread()
  socket.on('new-message', loadUnread)
  socket.on('unread-changed', loadUnread)
  socket.on('connect', loadUnread) // reconnected (e.g. server restarted): catch up on missed messages
  window.addEventListener('focus', loadUnread) // came back to this tab
})
onUnmounted(() => {
  socket.off('new-message', loadUnread)
  socket.off('unread-changed', loadUnread)
  socket.off('connect', loadUnread)
  window.removeEventListener('focus', loadUnread)
})
</script>
 
<template>
  <header class="container pt-3 site-header">
    <nav class="navbar navbar-expand-xl nav-card">
      <!-- logo + name -->
      <RouterLink class="navbar-brand d-flex align-items-center gap-2 me-xl-3" to="/home">
        <svg width="34" height="34" viewBox="0 0 34 34" aria-hidden="true">
          <defs>
            <linearGradient id="logo-gradient" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stop-color="#3ba7b6" />
              <stop offset="1" stop-color="#a98bd6" />
            </linearGradient>
          </defs>
          <rect width="34" height="34" rx="10" fill="url(#logo-gradient)" />
          <path d="M8 16 17 8l9 8v10H8z" fill="#fff" />
          <rect x="14" y="19" width="6" height="7" fill="#1f2a44" />
        </svg>
        <span>Homly Hauls</span>
      </RouterLink>
 
      <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#mainNav">
        <span class="navbar-toggler-icon"></span>
      </button>
 
      <div class="collapse navbar-collapse" id="mainNav">
        <!-- tabs: the page you are on gets a tinted pill (router-link-active) -->
        <ul class="navbar-nav me-auto gap-xl-1">
          <li class="nav-item"><RouterLink class="nav-link nav-pill" to="/home">
             <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-view-stacked" viewBox="0 0 16 16">
            <path d="M3 0h10a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V2a2 2 0 0 1 2-2m0 1a1 1 0 0 0-1 1v3a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1zm0 8h10a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2m0 1a1 1 0 0 0-1 1v3a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-3a1 1 0 0 0-1-1z"/>
          </svg>
            For you
          </RouterLink></li>
          <li class="nav-item"><RouterLink class="nav-link nav-pill" to="/browse">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-search" viewBox="0 0 16 16">
          <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001q.044.06.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1 1 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0"/>
        </svg>
            Browse
          </RouterLink></li>
          <!-- <li class="nav-item"><RouterLink class="nav-link nav-pill" to="/map">Map</RouterLink></li> -->
 
          <!-- buyers -->
          <template v-if="isLoggedIn && !isSeller">
            <li class="nav-item"><RouterLink class="nav-link nav-pill" to="/favourites">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-suit-heart" viewBox="0 0 16 16">
                  <path d="m8 6.236-.894-1.789c-.222-.443-.607-1.08-1.152-1.595C5.418 2.345 4.776 2 4 2 2.324 2 1 3.326 1 4.92c0 1.211.554 2.066 1.868 3.37.337.334.721.695 1.146 1.093C5.122 10.423 6.5 11.717 8 13.447c1.5-1.73 2.878-3.024 3.986-4.064.425-.398.81-.76 1.146-1.093C14.446 6.986 15 6.131 15 4.92 15 3.326 13.676 2 12 2c-.777 0-1.418.345-1.954.852-.545.515-.93 1.152-1.152 1.595zm.392 8.292a.513.513 0 0 1-.784 0c-1.601-1.902-3.05-3.262-4.243-4.381C1.3 8.208 0 6.989 0 4.92 0 2.755 1.79 1 4 1c1.6 0 2.719 1.05 3.404 2.008.26.365.458.716.596.992a7.6 7.6 0 0 1 .596-.992C9.281 2.049 10.4 1 12 1c2.21 0 4 1.755 4 3.92 0 2.069-1.3 3.288-3.365 5.227-1.193 1.12-2.642 2.48-4.243 4.38z"/>
                </svg>
                Favourites
            </RouterLink></li>
            <li class="nav-item"><RouterLink class="nav-link nav-pill" to="/orders">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-cart3" viewBox="0 0 16 16">
              <path d="M0 1.5A.5.5 0 0 1 .5 1H2a.5.5 0 0 1 .485.379L2.89 3H14.5a.5.5 0 0 1 .49.598l-1 5a.5.5 0 0 1-.465.401l-9.397.472L4.415 11H13a.5.5 0 0 1 0 1H4a.5.5 0 0 1-.491-.408L2.01 3.607 1.61 2H.5a.5.5 0 0 1-.5-.5M3.102 4l.84 4.479 9.144-.459L13.89 4zM5 12a2 2 0 1 0 0 4 2 2 0 0 0 0-4m7 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4m-7 1a1 1 0 1 1 0 2 1 1 0 0 1 0-2m7 0a1 1 0 1 1 0 2 1 1 0 0 1 0-2"/>
            </svg>
              My orders
            </RouterLink></li>
          </template>
 
          <!-- sellers -->
          <template v-if="isSeller">
            <li class="nav-item"><RouterLink class="nav-link nav-pill" to="/seller/analytics">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                <path d="M1 1h1v12h13v1H1V1zm3 7h2v4H4V8zm4-3h2v7H8V5zm4-3h2v10h-2V2z" />
              </svg>
              Analytics
            </RouterLink></li>
            <li class="nav-item"><RouterLink class="nav-link nav-pill" to="/seller/products">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-receipt" viewBox="0 0 16 16">
                <path d="M1.92.506a.5.5 0 0 1 .434.14L3 1.293l.646-.647a.5.5 0 0 1 .708 0L5 1.293l.646-.647a.5.5 0 0 1 .708 0L7 1.293l.646-.647a.5.5 0 0 1 .708 0L9 1.293l.646-.647a.5.5 0 0 1 .708 0l.646.647.646-.647a.5.5 0 0 1 .708 0l.646.647.646-.647a.5.5 0 0 1 .801.13l.5 1A.5.5 0 0 1 15 2v12a.5.5 0 0 1-.053.224l-.5 1a.5.5 0 0 1-.8.13L13 14.707l-.646.647a.5.5 0 0 1-.708 0L11 14.707l-.646.647a.5.5 0 0 1-.708 0L9 14.707l-.646.647a.5.5 0 0 1-.708 0L7 14.707l-.646.647a.5.5 0 0 1-.708 0L5 14.707l-.646.647a.5.5 0 0 1-.708 0L3 14.707l-.646.647a.5.5 0 0 1-.801-.13l-.5-1A.5.5 0 0 1 1 14V2a.5.5 0 0 1 .053-.224l.5-1a.5.5 0 0 1 .367-.27m.217 1.338L2 2.118v11.764l.137.274.51-.51a.5.5 0 0 1 .707 0l.646.647.646-.646a.5.5 0 0 1 .708 0l.646.646.646-.646a.5.5 0 0 1 .708 0l.646.646.646-.646a.5.5 0 0 1 .708 0l.646.646.646-.646a.5.5 0 0 1 .708 0l.646.646.646-.646a.5.5 0 0 1 .708 0l.509.509.137-.274V2.118l-.137-.274-.51.51a.5.5 0 0 1-.707 0L12 1.707l-.646.647a.5.5 0 0 1-.708 0L10 1.707l-.646.647a.5.5 0 0 1-.708 0L8 1.707l-.646.647a.5.5 0 0 1-.708 0L6 1.707l-.646.647a.5.5 0 0 1-.708 0L4 1.707l-.646.647a.5.5 0 0 1-.708 0z"/>
                <path d="M3 4.5a.5.5 0 0 1 .5-.5h6a.5.5 0 1 1 0 1h-6a.5.5 0 0 1-.5-.5m0 2a.5.5 0 0 1 .5-.5h6a.5.5 0 1 1 0 1h-6a.5.5 0 0 1-.5-.5m0 2a.5.5 0 0 1 .5-.5h6a.5.5 0 1 1 0 1h-6a.5.5 0 0 1-.5-.5m0 2a.5.5 0 0 1 .5-.5h6a.5.5 0 0 1 0 1h-6a.5.5 0 0 1-.5-.5m8-6a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 0 1h-1a.5.5 0 0 1-.5-.5m0 2a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 0 1h-1a.5.5 0 0 1-.5-.5m0 2a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 0 1h-1a.5.5 0 0 1-.5-.5m0 2a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 0 1h-1a.5.5 0 0 1-.5-.5"/>
              </svg>
              Add products
              </RouterLink></li>
            <li class="nav-item"><RouterLink class="nav-link nav-pill" to="/seller/orders">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-basket2" viewBox="0 0 16 16">
                <path d="M4 10a1 1 0 0 1 2 0v2a1 1 0 0 1-2 0zm3 0a1 1 0 0 1 2 0v2a1 1 0 0 1-2 0zm3 0a1 1 0 1 1 2 0v2a1 1 0 0 1-2 0z"/>
                <path d="M5.757 1.071a.5.5 0 0 1 .172.686L3.383 6h9.234L10.07 1.757a.5.5 0 1 1 .858-.514L13.783 6H15.5a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-.623l-1.844 6.456a.75.75 0 0 1-.722.544H3.69a.75.75 0 0 1-.722-.544L1.123 8H.5a.5.5 0 0 1-.5-.5v-1A.5.5 0 0 1 .5 6h1.717L5.07 1.243a.5.5 0 0 1 .686-.172zM2.163 8l1.714 6h8.246l1.714-6z"/>
              </svg>
              Shop orders
            </RouterLink></li>
             <li class="nav-item"><RouterLink class="nav-link nav-pill" to="/seller/shop">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-shop" viewBox="0 0 16 16">
              <path d="M2.97 1.35A1 1 0 0 1 3.73 1h8.54a1 1 0 0 1 .76.35l2.609 3.044A1.5 1.5 0 0 1 16 5.37v.255a2.375 2.375 0 0 1-4.25 1.458A2.37 2.37 0 0 1 9.875 8 2.37 2.37 0 0 1 8 7.083 2.37 2.37 0 0 1 6.125 8a2.37 2.37 0 0 1-1.875-.917A2.375 2.375 0 0 1 0 5.625V5.37a1.5 1.5 0 0 1 .361-.976zm1.78 4.275a1.375 1.375 0 0 0 2.75 0 .5.5 0 0 1 1 0 1.375 1.375 0 0 0 2.75 0 .5.5 0 0 1 1 0 1.375 1.375 0 1 0 2.75 0V5.37a.5.5 0 0 0-.12-.325L12.27 2H3.73L1.12 5.045A.5.5 0 0 0 1 5.37v.255a1.375 1.375 0 0 0 2.75 0 .5.5 0 0 1 1 0M1.5 8.5A.5.5 0 0 1 2 9v6h1v-5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v5h6V9a.5.5 0 0 1 1 0v6h.5a.5.5 0 0 1 0 1H.5a.5.5 0 0 1 0-1H1V9a.5.5 0 0 1 .5-.5M4 15h3v-5H4zm5-5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1zm3 0h-2v3h2z"/>
            </svg>
              My shop
            </RouterLink></li>
          </template>
        </ul>
 
        <!-- right side: Login button, or the user's name with a small menu.
             It sits inside a navbar-nav list so Bootstrap places the menu correctly on phones too. -->
        <ul class="navbar-nav mt-2 mt-xl-0">
          <!-- bell: new orders / reviews for sellers, order updates etc. for buyers -->
          <li v-if="isLoggedIn" class="nav-item me-xl-1">
            <NotificationBell />
          </li>
           <li v-if="isLoggedIn" class="nav-item me-xl-1">
            <RouterLink class="nav-link nav-pill d-flex align-items-center" to="/chats" title="Chats">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
              </svg>
              <span class="d-xl-none ms-2">Chats</span>
              <span v-if="unread > 0" class="badge rounded-pill bg-danger ms-1">{{ unread > 9 ? '9+' : unread }}</span>
            </RouterLink>
          </li>
          <li v-if="!isLoggedIn" class="nav-item">
            <RouterLink to="/login" class="btn nav-login">Login</RouterLink>
          </li>
 
          <li v-else class="nav-item dropdown">
            <button class="btn nav-login dropdown-toggle" type="button" data-bs-toggle="dropdown">
              {{ currentUser.name }}
            </button>
            <!-- Right-aligned on wide screens, normal inside the collapsed menu. -->
            <ul class="dropdown-menu dropdown-menu-xl-end">
              <li><RouterLink class="dropdown-item" to="/profile">Profile</RouterLink></li>
              <li><hr class="dropdown-divider" /></li>
              <li><button class="dropdown-item" type="button" @click="logout">Log out</button></li>
            </ul>
          </li>
        </ul>
      </div>
    </nav>
  </header>
</template>
 
<style scoped>
/* The nav bar (and its pop-ups: notifications, user menu) must sit ABOVE the page.
   The frosted-glass effect below gives the bar its own layer, so without this the product cards
   further down the page were drawn on top of the notification pop-up. */
.site-header {
  position: relative;
  z-index: 1030;
}

/* the white floating bar */
.nav-card {
  padding: 0.6rem 1rem;
  border: 1px solid rgba(255, 255, 255, 0.8);
  border-radius: 1.25rem;
  background: rgba(255, 255, 255, 0.85);
  box-shadow: var(--shadow);
  backdrop-filter: blur(10px);
}
 
/* tab pills */
.nav-pill {
  padding: 0.45rem 0.75rem !important;
  font-size: 0.95rem;
  border-radius: 999px;
  white-space: nowrap; /* "For you" / "Shop orders" never break onto two lines */
  font-weight: 500;
  color: var(--ink);
}
.nav-pill:hover {
  background: var(--surface-hover);
}
/* active tab: navy pill with white text (same as the tabs and the List / Map toggle) */
.nav-pill.router-link-active {
  background: var(--navy);
  color: #fff;
  box-shadow: 0 4px 10px rgba(var(--navy-rgb), 0.25);
}
 
/* outlined Login / user button */
.nav-login {
  padding: 0.45rem 1.1rem;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: #fff;
  font-weight: 500;
  color: var(--ink);
}
.nav-login:hover,
.nav-login:focus {
  border-color: var(--brand);
  color: var(--brand);
  background: #fff;
}
</style>
