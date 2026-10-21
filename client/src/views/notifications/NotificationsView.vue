<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { currentUser } from '@/utils/auth'
import { notifications, unreadCount, loadingNotifications, loadNotifications, markAllRead } from '@/utils/notifications'
import NotificationItem from '@/components/NotificationItem.vue'

// Owner: Cheyenne - /notifications  ("View all notifications" from the bell pop-up)
const router = useRouter()
const showUnreadOnly = ref(false)
const shown = computed(() => (showUnreadOnly.value ? notifications.value.filter((n) => !n.read) : notifications.value))

onMounted(() => {
  if (!currentUser.value) return router.push('/login')
  loadNotifications() // get the latest
})
</script>

<template>
  <div class="row justify-content-center">
    <div class="col-lg-8">
      <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
        <h3 class="mb-0">Notifications</h3>
        <div class="d-flex align-items-center gap-2">
          <div class="btn-group btn-group-sm" role="group" aria-label="Filter notifications">
            <button type="button" class="btn" :class="!showUnreadOnly ? 'btn-dark' : 'btn-outline-dark'" @click="showUnreadOnly = false">All</button>
            <button type="button" class="btn" :class="showUnreadOnly ? 'btn-dark' : 'btn-outline-dark'" @click="showUnreadOnly = true">
              Unread ({{ unreadCount }})
            </button>
          </div>
          <button type="button" class="btn btn-sm btn-outline-secondary" :disabled="unreadCount === 0" @click="markAllRead">Mark all as read</button>
        </div>
      </div>

      <div class="card shadow-sm p-2">
        <p v-if="loadingNotifications && notifications.length === 0" class="text-muted text-center py-4 mb-0">Loading...</p>
        <p v-else-if="shown.length === 0" class="text-muted text-center py-4 mb-0">
          {{ showUnreadOnly ? 'No unread notifications.' : 'No notifications yet.' }}
        </p>
        <NotificationItem v-for="n in shown" :key="n._id" :notification="n" class="mb-1" />
      </div>
      <p v-if="notifications.length >= 100" class="small text-muted mt-2">Showing your 100 newest notifications.</p>
    </div>
  </div>
</template>
