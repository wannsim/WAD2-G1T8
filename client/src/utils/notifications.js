import { ref, watch } from 'vue'
import axios from 'axios'
import { API_URL } from './config'
import { socket } from './socket'
import { currentUser } from './auth'

// Owner: Cheyenne
// ONE shared list of the logged-in user's notifications, used by the bell in NavBar
// and the /notifications page, so reading or deleting in one place updates the other.
// The server pushes 'notification' over Socket.IO when a new one arrives (server/utils/notify.js).
export const notifications = ref([]) // newest first (up to 100)
export const unreadCount = ref(0)
export const loadingNotifications = ref(false)

const userId = () => currentUser.value?._id

export async function loadNotifications() {
  if (!userId()) {
    notifications.value = []
    unreadCount.value = 0
    return
  }
  loadingNotifications.value = true
  try {
    const res = await axios.get(`${API_URL}/notifications/${userId()}`)
    notifications.value = res.data.notifications
    unreadCount.value = res.data.unread
  } catch (err) {
    // server might be off: ignore
  } finally {
    loadingNotifications.value = false
  }
}

// swap in the server's copy of one notification
function replace(updated) {
  const index = notifications.value.findIndex((n) => n._id === updated._id)
  if (index !== -1) notifications.value[index] = updated
  unreadCount.value = notifications.value.filter((n) => !n.read).length
}

export async function markRead(notification) {
  if (notification.read) return
  notification.read = true // show it as read straight away
  unreadCount.value = Math.max(unreadCount.value - 1, 0)
  try {
    const res = await axios.put(`${API_URL}/notifications/${notification._id}/read`, { user: userId() })
    replace(res.data)
  } catch (err) {
    loadNotifications()
  }
}

export async function markAllRead() {
  notifications.value.forEach((n) => (n.read = true))
  unreadCount.value = 0
  try {
    await axios.put(`${API_URL}/notifications/read-all`, { user: userId() })
  } catch (err) {
    loadNotifications()
  }
}

export async function deleteNotification(notification) {
  notifications.value = notifications.value.filter((n) => n._id !== notification._id)
  if (!notification.read) unreadCount.value = Math.max(unreadCount.value - 1, 0)
  try {
    await axios.delete(`${API_URL}/notifications/${notification._id}`, { data: { user: userId() } })
  } catch (err) {
    loadNotifications()
  }
}

// "Remove" on a sold out / deleted favourite
export async function removeFavourite(notification) {
  const res = await axios.post(`${API_URL}/notifications/${notification._id}/remove-favourite`, { user: userId() })
  replace(res.data)
}

// load on login / logout, and whenever the server says there is a new one
watch(() => currentUser.value?._id, loadNotifications, { immediate: true })
socket.on('notification', loadNotifications)
