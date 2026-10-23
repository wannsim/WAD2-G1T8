<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { notifications, unreadCount, markAllRead } from '@/utils/notifications'
import NotificationItem from './NotificationItem.vue'

// Owner: Cheyenne
// Bell icon in the navbar (buyers and sellers). Click -> small pop-up with the 5 newest notifications.
const open = ref(false)
const root = ref(null)
const route = useRoute()
const latest = computed(() => notifications.value.slice(0, 5))

const close = () => (open.value = false)
watch(() => route.fullPath, close) // close after going to another page

// click anywhere outside the bell / pop-up closes it
function onDocumentClick(event) {
  if (open.value && root.value && !root.value.contains(event.target)) close()
}
const onKeydown = (event) => event.key === 'Escape' && close()
onMounted(() => {
  document.addEventListener('click', onDocumentClick)
  document.addEventListener('keydown', onKeydown)
})
onUnmounted(() => {
  document.removeEventListener('click', onDocumentClick)
  document.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <div ref="root" class="bell-wrap">
    <button type="button" class="nav-link nav-pill bell-btn d-flex align-items-center" :class="{ active: open }"
      :data-label="open ? null : 'Notifications'" aria-label="Notifications" :aria-expanded="open" @click="open = !open">
      <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
        <path d="M8 16a2 2 0 0 0 2-2H6a2 2 0 0 0 2 2M8 1.918l-.797.161A4 4 0 0 0 4 6c0 .628-.134 2.197-.459 3.742-.16.767-.376 1.566-.663 2.258h10.244c-.287-.692-.502-1.49-.663-2.258C12.134 8.197 12 6.628 12 6a4 4 0 0 0-3.203-3.92zM14.22 12c.223.447.481.801.78 1H1c.299-.199.557-.553.78-1C2.68 10.2 3 6.88 3 6c0-2.42 1.72-4.44 4.005-4.901a1 1 0 1 1 1.99 0A5 5 0 0 1 13 6c0 .88.32 4.2 1.22 6" />
      </svg>
      <span class="d-xl-none ms-2">Notifications</span>
      <span v-if="unreadCount > 0" class="badge rounded-pill bg-danger ms-1">{{ unreadCount > 9 ? '9+' : unreadCount }}</span>
    </button>

    <div v-if="open" class="popup" role="dialog" aria-label="Notifications">
      <div class="d-flex justify-content-between align-items-center px-3 pt-3 pb-2">
        <h6 class="mb-0">Notifications</h6>
        <button v-if="unreadCount > 0" type="button" class="btn btn-link btn-sm p-0 text-decoration-none" @click="markAllRead">
          Mark all as read
        </button>
      </div>

      <div class="list px-2">
        <p v-if="latest.length === 0" class="text-muted small text-center py-4 mb-0">No notifications yet.</p>
        <NotificationItem v-for="n in latest" :key="n._id" :notification="n" class="mb-1" @navigate="close" />
      </div>

      <RouterLink to="/notifications" class="view-all d-block text-center py-2">View all notifications</RouterLink>
    </div>
  </div>
</template>

<style scoped>
.bell-wrap {
  position: relative;
}
.bell-btn {
  position: relative;
  width: 100%;
  padding: 0.5rem 1rem;
  border: 0;
  border-radius: 0.75rem;
  background: transparent;
  font-weight: 500;
  color: var(--ink);
}
.bell-btn:hover {
  background: var(--surface-hover);
}
.bell-btn.active {
  background: rgba(var(--brand-rgb), 0.1);
  color: var(--brand);
}
/* "Notifications" label under the bell on hover (wide screens; on phones the word is already shown) */
@media (min-width: 1200px) {
  .bell-btn[data-label]:hover::after,
  .bell-btn[data-label]:focus-visible::after {
    content: attr(data-label);
    position: absolute;
    top: calc(100% + 6px);
    left: 50%;
    transform: translateX(-50%);
    padding: 2px 8px;
    border-radius: 4px;
    background: var(--navy);
    color: #fff;
    font-size: 0.75rem;
    font-weight: 400;
    white-space: nowrap;
    pointer-events: none;
    z-index: 1050;
  }
}
.popup {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  z-index: 1050;
  width: 370px;
  border-radius: 1rem;
  background: #fff;
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.16);
  overflow: hidden;
}
.list {
  max-height: 420px;
  overflow-y: auto;
}
.view-all {
  border-top: 1px solid var(--line);
  font-weight: 500;
  color: var(--brand);
  text-decoration: none;
}
.view-all:hover {
  background: var(--surface-hover);
}
/* inside the collapsed phone menu: show the pop-up in the menu instead of floating */
@media (max-width: 1199.98px) {
  .popup {
    position: static;
    width: 100%;
    margin: 0.25rem 0 0.5rem;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  }
}
</style>
