<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import NavBar from './components/NavBar.vue'
import TopBar from './components/TopBar.vue'

// App frame (like the BuyMore inspiration): white rounded panel, sidebar on the left, top bar + page on the right.
// Login / Register are "bare": no frame, so their full-screen backgrounds show.
const route = useRoute()
const bare = computed(() => route.path === '/login' || route.path === '/register')
</script>

<template>
  <div v-if="bare" class="bare-page">
    <RouterLink to="/home" class="bare-brand">Homly Hauls</RouterLink>
    <main class="container py-4">
      <RouterView />
    </main>
  </div>
  <div v-else class="app-frame">
    <NavBar />
    <div class="app-main">
      <TopBar />
      <main class="app-content">
        <RouterView />
      </main>
    </div>
  </div>
</template>

<style scoped>
.app-frame {
  display: flex;
  align-items: flex-start;
  max-width: 1480px;
  min-height: calc(100vh - 2rem);
  margin: 1rem auto;
  border-radius: 2rem;
  background: var(--surface);
  box-shadow: 0 20px 60px rgba(var(--navy-rgb), 0.08);
}
/* rounded frame corners also on the sticky sidebar */
.app-frame > :deep(.sidebar) {
  border-radius: 2rem 0 0 2rem;
}
.app-main {
  flex: 1;
  min-width: 0;
  align-self: stretch;
  border-left: 1px solid var(--line); /* full-height line next to the sidebar */
}
.app-content {
  padding: 0.5rem 2rem 2.5rem;
  padding-top: 1.5rem;
}
@media (max-width: 991.98px) {
  .app-frame {
    min-height: 100vh;
    margin: 0;
    border-radius: 0;
  }
  .app-content {
    padding: 1.25rem 1rem 2rem;
  }
  .app-main {
    border-left: 0;
  }
}

.bare-brand {
  position: relative;
  z-index: 1;
  display: inline-block;
  margin: 1.25rem 1.5rem 0;
  padding: 0.5rem 1rem;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.9);
  font-weight: 700;
  color: var(--navy);
  text-decoration: none;
}
</style>
