<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

// "← Back" above every page (App.vue). Goes back in history, so the page you came from keeps its
// filters and scroll. Opened straight from a link (no page before it) -> goes to the page's parent
// instead (e.g. a product -> Browse).
// Hidden on the main pages (sidebar / top bar tabs): moving between tabs is not "going deeper".
const route = useRoute()
const router = useRouter()

const MAIN_PAGES = [
  '/home', '/browse', '/map', '/favourites', '/orders',
  '/seller/analytics', '/seller/products', '/seller/orders', '/seller/shop', '/seller/calendar',
  '/notifications', '/chats', '/profile',
]
// where to go when there is no page before this one
const PARENTS = [
  [/^\/products\/[^/]+$/, '/browse'],
  [/^\/shops\/[^/]+$/, '/map'],
  [/^\/order\/new\/([^/]+)$/, (m) => `/products/${m[1]}`],
  [/^\/review\//, '/orders'],
  [/^\/chats\/.+/, '/chats'],
  [/^\/seller\/shop\/edit$/, '/seller/shop'],
  [/^\/seller\/products\/.+/, '/seller/shop'],
]
const SKIP = ['/login', '/register'] // never send people back to the login form

// route.fullPath is read so this updates on every navigation (history.state changes with it)
const previous = computed(() => {
  void route.fullPath
  const back = window.history.state?.back
  return back && !SKIP.includes(back.split('?')[0]) ? back : ''
})
const parent = computed(() => {
  for (const [match, to] of PARENTS) {
    const m = route.path.match(match)
    if (m) return typeof to === 'function' ? to(m) : to
  }
  return ''
})
const show = computed(() => !MAIN_PAGES.includes(route.path) && !!(previous.value || parent.value))

function goBack() {
  if (previous.value) router.back()
  else router.push(parent.value)
}
</script>

<template>
  <button v-if="show" type="button" class="back-btn" @click="goBack">
    <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path fill-rule="evenodd" d="M15 8a.5.5 0 0 0-.5-.5H2.707l3.147-3.146a.5.5 0 1 0-.708-.708l-4 4a.5.5 0 0 0 0 .708l4 4a.5.5 0 0 0 .708-.708L2.707 8.5H14.5A.5.5 0 0 0 15 8" />
    </svg>
    Back
  </button>
</template>

<style scoped>
.back-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  margin-bottom: 0.9rem;
  padding: 0;
  border: 0;
  background: none;
  font-size: 1rem;
  font-weight: 500;
  color: var(--ink-soft);
  transition: color 0.15s ease;
}
.back-btn:hover {
  color: var(--ink);
}
.back-btn svg {
  transition: transform 0.15s ease;
}
.back-btn:hover svg {
  transform: translateX(-2px);
}
</style>
