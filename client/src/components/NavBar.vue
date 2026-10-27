<script setup>
import { computed, watch, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { currentUser, isLoggedIn, isSeller, clearUser } from '@/utils/auth'
import { navOpen, navCollapsed, recentOrders, loadRecentOrders } from '@/utils/layout'
import { API_URL } from '@/utils/config'

// Owner: Wan Sim (sidebar layout: Cheyenne)
// Left sidebar, like the BuyMore inspiration: logo, main links, last orders, log out.
// Wide screens: collapsed to icons by default (like Instagram); hovering opens it over the page,
// the » button keeps it open (« collapses it again). Phones / tablets: a drawer opened from the top bar's ☰ button.
const router = useRouter()
const route = useRoute()

function logout() {
  clearUser()
  router.push('/login')
}

// bootstrap-icons paths (16x16)
const ICONS = {
  foryou: 'M3 0h10a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V2a2 2 0 0 1 2-2m0 1a1 1 0 0 0-1 1v3a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1zm0 8h10a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2m0 1a1 1 0 0 0-1 1v3a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-3a1 1 0 0 0-1-1z',
  browse: 'M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001q.044.06.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1 1 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0',
  map: 'M15.817.113A.5.5 0 0 1 16 .5v14a.5.5 0 0 1-.402.49l-5 1a.5.5 0 0 1-.196 0L5.5 15.01l-4.902.98A.5.5 0 0 1 0 15.5v-14a.5.5 0 0 1 .402-.49l5-1a.5.5 0 0 1 .196 0L10.5.99l4.902-.98a.5.5 0 0 1 .415.103M10 1.91l-4-.8v12.98l4 .8zm1 12.98 4-.8V1.11l-4 .8zm-6-.8V1.11l-4 .8v12.98z',
  heart: 'm8 2.748-.717-.737C5.6.281 2.514.878 1.4 3.053c-.523 1.023-.641 2.5.314 4.385.92 1.815 2.834 3.989 6.286 6.357 3.452-2.368 5.365-4.542 6.286-6.357.955-1.886.838-3.362.314-4.385C13.486.878 10.4.28 8.717 2.01zM8 15C-7.333 4.868 3.279-3.04 7.824 1.143q.09.083.176.171a3 3 0 0 1 .176-.17C12.72-3.042 23.333 4.867 8 15',
  cart: 'M0 1.5A.5.5 0 0 1 .5 1H2a.5.5 0 0 1 .485.379L2.89 3H14.5a.5.5 0 0 1 .49.598l-1 5a.5.5 0 0 1-.465.401l-9.397.472L4.415 11H13a.5.5 0 0 1 0 1H4a.5.5 0 0 1-.491-.408L2.01 3.607 1.61 2H.5a.5.5 0 0 1-.5-.5M3.102 4l.84 4.479 9.144-.459L13.89 4zM5 12a2 2 0 1 0 0 4 2 2 0 0 0 0-4m7 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4m-7 1a1 1 0 1 1 0 2 1 1 0 0 1 0-2m7 0a1 1 0 1 1 0 2 1 1 0 0 1 0-2',
  chart: 'M1 1h1v12h13v1H1V1zm3 7h2v4H4V8zm4-3h2v7H8V5zm4-3h2v10h-2V2z',
  plusSquare: 'M14 1a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1zM2 0a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V2a2 2 0 0 0-2-2zm6.5 4.5a.5.5 0 0 0-1 0v3h-3a.5.5 0 0 0 0 1h3v3a.5.5 0 0 0 1 0v-3h3a.5.5 0 0 0 0-1h-3z',
  basket: 'M5.757 1.071a.5.5 0 0 1 .172.686L3.383 6h9.234L10.07 1.757a.5.5 0 1 1 .858-.514L13.783 6H15.5a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-.623l-1.844 6.456a.75.75 0 0 1-.722.544H3.69a.75.75 0 0 1-.722-.544L1.123 8H.5a.5.5 0 0 1-.5-.5v-1A.5.5 0 0 1 .5 6h1.717L5.07 1.243a.5.5 0 0 1 .686-.172zM2.163 8l1.714 6h8.246l1.714-6z',
  shop: 'M2.97 1.35A1 1 0 0 1 3.73 1h8.54a1 1 0 0 1 .76.35l2.609 3.044A1.5 1.5 0 0 1 16 5.37v.255a2.375 2.375 0 0 1-4.25 1.458A2.37 2.37 0 0 1 9.875 8 2.37 2.37 0 0 1 8 7.083 2.37 2.37 0 0 1 6.125 8a2.37 2.37 0 0 1-1.875-.917A2.375 2.375 0 0 1 0 5.625V5.37a1.5 1.5 0 0 1 .361-.976zm1.78 4.275a1.375 1.375 0 0 0 2.75 0 .5.5 0 0 1 1 0 1.375 1.375 0 0 0 2.75 0 .5.5 0 0 1 1 0 1.375 1.375 0 1 0 2.75 0V5.37a.5.5 0 0 0-.12-.325L12.27 2H3.73L1.12 5.045A.5.5 0 0 0 1 5.37v.255a1.375 1.375 0 0 0 2.75 0 .5.5 0 0 1 1 0M1.5 8.5A.5.5 0 0 1 2 9v6h1v-5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v5h6V9a.5.5 0 0 1 1 0v6h.5a.5.5 0 0 1 0 1H.5a.5.5 0 0 1 0-1H1V9a.5.5 0 0 1 .5-.5M4 15h3v-5H4zm5-5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1zm3 0h-2v3h2z',
  collapse: 'M8.354 1.646a.5.5 0 0 1 0 .708L2.707 8l5.647 5.646a.5.5 0 0 1-.708.708l-6-6a.5.5 0 0 1 0-.708l6-6a.5.5 0 0 1 .708 0m6 0a.5.5 0 0 1 0 .708L8.707 8l5.647 5.646a.5.5 0 0 1-.708.708l-6-6a.5.5 0 0 1 0-.708l6-6a.5.5 0 0 1 .708 0',
  logout: 'M10 12.5a.5.5 0 0 1-.5.5h-8a.5.5 0 0 1-.5-.5v-9a.5.5 0 0 1 .5-.5h8a.5.5 0 0 1 .5.5v2a.5.5 0 0 0 1 0v-2A1.5 1.5 0 0 0 9.5 2h-8A1.5 1.5 0 0 0 0 3.5v9A1.5 1.5 0 0 0 1.5 14h8a1.5 1.5 0 0 0 1.5-1.5v-2a.5.5 0 0 0-1 0zM15.854 8.354a.5.5 0 0 0 0-.708l-3-3a.5.5 0 0 0-.708.708L14.293 7.5H5.5a.5.5 0 0 0 0 1h8.793l-2.147 2.146a.5.5 0 0 0 .708.708z',
}

// main links: everyone, then buyers or sellers
const links = computed(() => {
  const list = [
    { to: '/home', label: 'For you', icon: 'foryou' },
    { to: '/browse', label: 'Browse', icon: 'browse' },
    { to: '/map', label: 'Shops near you', icon: 'map' },
  ]
  if (isLoggedIn.value && !isSeller.value) {
    list.push({ to: '/favourites', label: 'Favourites', icon: 'heart' }, { to: '/orders', label: 'My orders', icon: 'cart' })
  }
  if (isSeller.value) {
    list.push(
      { to: '/seller/analytics', label: 'Analytics', icon: 'chart' },
      { to: '/seller/products', label: 'Add products', icon: 'plusSquare' },
      { to: '/seller/orders', label: 'Shop orders', icon: 'basket' },
      { to: '/seller/shop', label: 'My shop', icon: 'shop' },
    )
  }
  return list
})

const ordersLink = computed(() => (isSeller.value ? '/seller/orders' : '/orders'))
const lastOrders = computed(() => recentOrders.value.slice(0, 2))
const orderTitle = (o) => (isSeller.value ? `${o.product?.name || 'Order'} · ${o.buyer?.name || ''}` : o.product?.name || 'Order')

watch(() => route.fullPath, () => (navOpen.value = false)) // close the drawer after choosing a page
onMounted(loadRecentOrders)
</script>

<template>
  <aside class="sidebar" :class="{ open: navOpen, collapsed: navCollapsed }" aria-label="Main menu">
    <div class="sidebar-top d-flex align-items-center justify-content-between">
      <RouterLink class="brand" to="/home" title="Homly Hauls">
        <svg width="32" height="32" viewBox="0 0 34 34" aria-hidden="true">
          <defs>
            <linearGradient id="logo-gradient" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stop-color="#24498a" />
              <stop offset="1" stop-color="#5b86c5" />
            </linearGradient>
          </defs>
          <rect width="34" height="34" rx="10" fill="url(#logo-gradient)" />
          <path d="M8 16 17 8l9 8v10H8z" fill="#fff" />
          <rect x="14" y="19" width="6" height="7" fill="#13284b" />
        </svg>
        <span class="label">Homly Hauls</span>
      </RouterLink>
      <button type="button" class="close-drawer" aria-label="Close menu" @click="navOpen = false">&times;</button>
      <button type="button" class="collapse-btn" :aria-label="navCollapsed ? 'Keep menu open' : 'Collapse menu'"
        :title="navCollapsed ? 'Keep menu open' : 'Collapse menu'" :aria-expanded="!navCollapsed" @click="navCollapsed = !navCollapsed">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path :d="ICONS.collapse" /></svg>
      </button>
    </div>
    <span class="brand-underline" aria-hidden="true"></span>

    <nav class="side-links">
      <RouterLink v-for="link in links" :key="link.to" :to="link.to" class="side-link" :title="navCollapsed ? link.label : null">
        <svg width="17" height="17" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path :d="ICONS[link.icon]" /></svg>
        <span class="label">{{ link.label }}</span>
      </RouterLink>
    </nav>

    <div v-if="isLoggedIn" class="side-section">
      <p class="side-heading">Last orders <strong>{{ recentOrders.length }}</strong></p>
      <p v-if="recentOrders.length === 0" class="small text-muted mb-2">No orders yet.</p>
      <RouterLink v-for="o in lastOrders" :key="o._id" :to="ordersLink" class="last-order">
        <img v-if="o.product" :src="`${API_URL}/products/${o.product._id}/image/0`" alt="" @error="$event.target.style.visibility = 'hidden'" />
        <span class="clamp-1">{{ orderTitle(o) }}</span>
        <span class="view">View order</span>
      </RouterLink>
      <RouterLink v-if="recentOrders.length" :to="ordersLink" class="see-all">See all</RouterLink>
    </div>

    <!-- only for signed-in users (logged-out visitors use the Log in button in the top bar) -->
    <div v-if="isLoggedIn" class="side-bottom">
      <button type="button" class="side-link w-100" :title="navCollapsed ? 'Log out' : null" @click="logout">
        <svg width="17" height="17" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path :d="ICONS.logout" /></svg>
        <span class="label">Log out</span>
      </button>
      <p class="small text-muted mt-2 mb-0 px-3 clamp-1">Signed in as {{ currentUser.name }}</p>
    </div>
  </aside>
  <div v-if="navOpen" class="drawer-shade" @click="navOpen = false"></div>
</template>

<style scoped>
.sidebar {
  position: sticky;
  top: 0;
  display: flex;
  flex-direction: column;
  flex: 0 0 248px;
  width: 248px;
  height: 100vh;
  max-height: 100vh;
  padding: 1.75rem 1.1rem 1.25rem;
  overflow-y: auto;
  background: var(--surface);
}
.brand {
  display: inline-flex;
  align-items: center;
  gap: 0.55rem;
  padding: 0 0.6rem;
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--navy);
  text-decoration: none;
}
.brand-underline {
  display: block;
  width: 28px;
  height: 3px;
  margin: 0.35rem 0 1.75rem 3.4rem;
  border-radius: 3px;
  background: var(--ocean);
}
.close-drawer {
  display: none;
  border: 0;
  background: none;
  font-size: 1.8rem;
  line-height: 1;
  color: var(--muted);
}

.side-links {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}
.side-link {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.7rem 1rem;
  border: 0;
  border-radius: 1rem;
  background: none;
  font-size: 0.95rem;
  color: var(--ink);
  text-align: left;
  text-decoration: none;
  transition: background 0.15s ease, color 0.15s ease;
}
.side-link:hover {
  background: var(--tile);
}
/* the page you are on: navy gradient pill */
.side-link.router-link-active {
  background: linear-gradient(135deg, var(--ocean), var(--aqua));
  color: #fff;
  box-shadow: 0 8px 18px rgba(var(--ocean-rgb), 0.3);
}

.side-section {
  margin-top: 1.25rem;
  padding-top: 1.25rem;
  border-top: 1px solid var(--line);
}
.side-heading {
  margin: 0 0 0.6rem;
  padding: 0 1rem;
  font-size: 0.82rem;
  color: var(--muted);
}
.side-heading strong {
  color: var(--navy);
}
.last-order {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  padding: 0.4rem 1rem;
  border-radius: 0.8rem;
  font-size: 0.85rem;
  color: var(--ink);
  text-decoration: none;
}
.last-order:hover {
  background: var(--tile);
}
.last-order img {
  width: 28px;
  height: 28px;
  flex-shrink: 0;
  border-radius: 50%;
  object-fit: cover;
  background: var(--tile);
}
.last-order .clamp-1 {
  flex: 1;
  min-width: 0;
}
.last-order .view {
  flex-shrink: 0;
  font-size: 0.75rem;
  color: var(--muted);
}
.see-all {
  display: inline-block;
  margin: 0.4rem 1rem 0;
  font-size: 0.8rem;
  color: var(--muted);
}
.side-bottom {
  margin-top: auto;
  padding-top: 1.5rem;
}

/* « button: wide screens only (phones use the drawer) */
.collapse-btn {
  display: inline-grid;
  place-items: center;
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  border: 0;
  border-radius: 50%;
  background: var(--tile);
  color: var(--ink-soft);
  transition: transform 0.2s ease;
}
.collapse-btn:hover {
  color: var(--navy);
}
.sidebar {
  transition: flex-basis 0.2s ease, width 0.2s ease, margin-right 0.2s ease, box-shadow 0.2s ease;
}

@media (min-width: 992px) {
  /* collapsed: a narrow rail with just the icons (labels show as tooltips) */
  .sidebar.collapsed {
    flex-basis: 84px;
    width: 84px;
  }
  /* collapsed + hovered (or reached with the Tab key): opens to full width ON TOP of the page.
     The negative margin keeps its place in the layout at 84px, so the page doesn't jump */
  .sidebar.collapsed:hover,
  .sidebar.collapsed:has(:focus-visible) {
    flex-basis: 248px;
    width: 248px;
    margin-right: -164px;
    z-index: 1035; /* above the top bar (1030), below pop-up dialogs (1050+) */
    box-shadow: 12px 0 40px rgba(var(--navy-rgb), 0.16);
    transition-delay: 0.08s; /* a quick pass of the mouse doesn't flash it open */
  }
  .sidebar.collapsed:not(:hover):not(:has(:focus-visible)) {
    padding-left: 0.85rem;
    padding-right: 0.85rem;
  }
  .sidebar.collapsed:not(:hover):not(:has(:focus-visible)) .sidebar-top {
    flex-direction: column;
    gap: 0.75rem;
  }
  .sidebar.collapsed:not(:hover):not(:has(:focus-visible)) .brand {
    padding: 0;
  }
  /* » = "keep it open"; « = "collapse it" */
  .sidebar.collapsed .collapse-btn {
    transform: rotate(180deg);
  }
  .sidebar.collapsed:not(:hover):not(:has(:focus-visible)) .label,
  .sidebar.collapsed:not(:hover):not(:has(:focus-visible)) .brand-underline,
  .sidebar.collapsed:not(:hover):not(:has(:focus-visible)) .side-section,
  .sidebar.collapsed:not(:hover):not(:has(:focus-visible)) .side-bottom p {
    display: none;
  }
  .sidebar.collapsed:not(:hover):not(:has(:focus-visible)) .side-links {
    margin-top: 1.25rem;
  }
  .sidebar.collapsed:not(:hover):not(:has(:focus-visible)) .side-link {
    justify-content: center;
    padding: 0.7rem 0;
  }
  .sidebar.collapsed .label {
    white-space: nowrap; /* labels don't wrap while it slides open */
  }
}

/* phones / tablets: the sidebar slides in from the left */
.drawer-shade {
  display: none;
}
@media (max-width: 991.98px) {
  .sidebar {
    position: fixed;
    top: 0;
    left: 0;
    bottom: 0;
    z-index: 1050;
    height: auto;
    max-height: none;
    width: min(300px, 86vw);
    border-right: 0;
    box-shadow: 0 0 40px rgba(var(--navy-rgb), 0.25);
    transform: translateX(-105%);
    transition: transform 0.25s ease;
  }
  .sidebar.open {
    transform: none;
  }
  .close-drawer {
    display: block;
  }
  .collapse-btn {
    display: none;
  }
  .drawer-shade {
    display: block;
    position: fixed;
    inset: 0;
    z-index: 1040;
    background: rgba(var(--navy-rgb), 0.35);
  }
}
@media (prefers-reduced-motion: reduce) {
  .sidebar, .collapse-btn { transition: none; }
}
</style>
