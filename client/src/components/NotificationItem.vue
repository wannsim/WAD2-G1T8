<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { formatShortDateTime } from '@/utils/format'
import { markRead, deleteNotification, removeFavourite } from '@/utils/notifications'

// Owner: Cheyenne
// One notification row. Used in the bell pop-up (NavBar) and on the /notifications page.
//   click -> marked as read, then opens its page (if it has one)
//   x     -> deletes it
//   "Remove" (sold out / deleted favourites only) -> takes the item out of the buyer's favourites
const props = defineProps({ notification: { type: Object, required: true } })
const emit = defineEmits(['navigate']) // the pop-up closes itself when a notification opens a page
const router = useRouter()
const removing = ref(false)
const removeError = ref('')

// Bootstrap Icons paths (same icon set as the navbar)
const ICONS = {
  'new-order': { colour: '#2f63e0', path: 'M5.757 1.071a.5.5 0 0 1 .172.686L3.383 6h9.234L10.07 1.757a.5.5 0 1 1 .858-.514L13.783 6H15.5a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-.623l-1.844 6.456a.75.75 0 0 1-.722.544H3.69a.75.75 0 0 1-.722-.544L1.123 8H.5a.5.5 0 0 1-.5-.5v-1A.5.5 0 0 1 .5 6h1.717L5.07 1.243a.5.5 0 0 1 .686-.172zM2.163 8l1.714 6h8.246l1.714-6z' },
  'new-review': { colour: '#e0a526', path: 'M3.612 15.443c-.386.198-.824-.149-.746-.592l.83-4.73L.173 6.765c-.329-.314-.158-.888.283-.95l4.898-.696L7.538.792c.197-.39.73-.39.927 0l2.184 4.327 4.898.696c.441.062.612.636.282.95l-3.522 3.356.83 4.73c.078.443-.36.79-.746.592L8 13.187l-4.389 2.256z' },
  'order-update': { colour: '#23899f', path: 'M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0m-3.97-3.03a.75.75 0 0 0-1.08.022L7.477 9.417 5.384 7.323a.75.75 0 0 0-1.06 1.06L6.97 11.03a.75.75 0 0 0 1.079-.02l3.992-4.99a.75.75 0 0 0-.01-1.05z' },
  'review-reminder': { colour: '#e0a526', path: 'M3.612 15.443c-.386.198-.824-.149-.746-.592l.83-4.73L.173 6.765c-.329-.314-.158-.888.283-.95l4.898-.696L7.538.792c.197-.39.73-.39.927 0l2.184 4.327 4.898.696c.441.062.612.636.282.95l-3.522 3.356.83 4.73c.078.443-.36.79-.746.592L8 13.187l-4.389 2.256z' },
  'favourite-unavailable': { colour: '#e0607e', path: 'm8 2.748-.717-.737C5.6.281 2.514.878 1.4 3.053c-.523 1.023-.641 2.5.314 4.385.92 1.815 2.834 3.989 6.286 6.357 3.452-2.368 5.365-4.542 6.286-6.357.955-1.886.838-3.362.314-4.385C13.486.878 10.4.28 8.717 2.01zM8 15C-7.333 4.868 3.279-3.04 7.824 1.143q.09.083.176.171a3 3 0 0 1 .176-.17C12.72-3.042 23.333 4.867 8 15' },
  'new-product': { colour: '#36b3cc', path: 'M2.97 1.35A1 1 0 0 1 3.73 1h8.54a1 1 0 0 1 .76.35l2.609 3.044A1.5 1.5 0 0 1 16 5.37v.255a2.375 2.375 0 0 1-4.25 1.458A2.37 2.37 0 0 1 9.875 8 2.37 2.37 0 0 1 8 7.083 2.37 2.37 0 0 1 6.125 8a2.37 2.37 0 0 1-1.875-.917A2.375 2.375 0 0 1 0 5.625V5.37a1.5 1.5 0 0 1 .361-.976zm1.78 4.275a1.375 1.375 0 0 0 2.75 0 .5.5 0 0 1 1 0 1.375 1.375 0 0 0 2.75 0 .5.5 0 0 1 1 0 1.375 1.375 0 1 0 2.75 0V5.37a.5.5 0 0 0-.12-.325L12.27 2H3.73L1.12 5.045A.5.5 0 0 0 1 5.37v.255a1.375 1.375 0 0 0 2.75 0 .5.5 0 0 1 1 0M1.5 8.5A.5.5 0 0 1 2 9v6h1v-5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v5h6V9a.5.5 0 0 1 1 0v6h.5a.5.5 0 0 1 0 1H.5a.5.5 0 0 1 0-1H1V9a.5.5 0 0 1 .5-.5M4 15h3v-5H4zm5-5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1zm3 0h-2v3h2z' },
}
const icon = ICONS[props.notification.type] || ICONS['order-update']

function open() {
  markRead(props.notification)
  if (props.notification.link) {
    emit('navigate')
    router.push(props.notification.link)
  }
}

async function onRemove() {
  removing.value = true
  removeError.value = ''
  try {
    await removeFavourite(props.notification)
  } catch (err) {
    removeError.value = 'Could not remove it. Please try again.'
  } finally {
    removing.value = false
  }
}
</script>

<template>
  <div class="notification d-flex gap-2" :class="{ unread: !notification.read, clickable: notification.link }"
    :role="notification.link ? 'link' : undefined" :tabindex="notification.link ? 0 : undefined"
    @click="open" @keydown.enter="open">
    <span class="type-icon flex-shrink-0" :style="{ color: icon.colour, backgroundColor: `${icon.colour}1a` }" aria-hidden="true">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path :d="icon.path" /></svg>
    </span>

    <div class="flex-grow-1 min-w-0 pe-4">
      <div class="d-flex align-items-center gap-2">
        <span v-if="!notification.read" class="unread-dot" aria-label="Unread"></span>
        <span class="title">{{ notification.title }}</span>
      </div>
      <div class="small text-body-secondary">{{ notification.message }}</div>
      <div class="d-flex align-items-center gap-2 mt-1">
        <span class="time">{{ formatShortDateTime(notification.createdAt) }}</span>
        <template v-if="notification.type === 'favourite-unavailable'">
          <span v-if="notification.done" class="small text-success">Removed from favourites</span>
          <button v-else type="button" class="btn btn-sm btn-outline-danger py-0 px-2" :disabled="removing" @click.stop="onRemove">
            {{ removing ? 'Removing...' : 'Remove' }}
          </button>
        </template>
      </div>
      <div v-if="removeError" class="small text-danger">{{ removeError }}</div>
    </div>

    <button type="button" class="delete-btn" data-label="Delete notification" aria-label="Delete notification"
      @click.stop="deleteNotification(notification)">&times;</button>
  </div>
</template>

<style scoped>
.notification {
  position: relative;
  padding: 0.65rem 0.75rem;
  border-radius: 0.6rem;
  background: #fff;
}
.notification.clickable {
  cursor: pointer;
}
.notification.clickable:hover {
  background: var(--surface-hover);
}
/* unread = tinted with the brand colour */
.notification.unread {
  background: rgba(var(--brand-rgb), 0.07);
}
.notification.unread.clickable:hover {
  background: rgba(var(--brand-rgb), 0.12);
}
.title {
  font-size: 0.9rem;
  font-weight: 500;
}
.unread .title {
  font-weight: 700;
}
.unread-dot {
  flex-shrink: 0;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--brand);
}
.time {
  font-size: 0.75rem;
  color: var(--muted);
}
.type-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
}
.min-w-0 {
  min-width: 0;
}
.delete-btn {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 24px;
  height: 24px;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: var(--muted);
  font-size: 1.1rem;
  line-height: 1;
}
.delete-btn:hover,
.delete-btn:focus-visible {
  background: var(--surface-hover);
  color: var(--ink);
}
/* "Delete notification" label on hover, to the left of the x so it stays inside the pop-up */
.delete-btn:hover::after,
.delete-btn:focus-visible::after {
  content: attr(data-label);
  position: absolute;
  top: 50%;
  right: calc(100% + 6px);
  transform: translateY(-50%);
  padding: 2px 8px;
  border-radius: 4px;
  background: var(--navy);
  color: #fff;
  font-size: 0.75rem;
  white-space: nowrap;
  pointer-events: none;
  z-index: 10;
}
</style>
