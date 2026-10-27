<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import axios from 'axios'
import { currentUser } from '@/utils/auth'

// Round profile picture. With `editable`, clicking it opens an Instagram-style "Change Profile Photo" box
// (Upload Photo / Remove Current Photo / Cancel). Used by ShopHeader (shop picture) and the buyer's profile page.
//   <AvatarEditor :src="url" :name="shop.name" size="160px" editable
//     :upload-url="`${API_URL}/shops/${id}/avatar`" :remove-url="`${API_URL}/shops/${id}/avatar`"
//     @uploaded="(data) => ..." @removed="(data) => ..." @error="(message) => ..." />
// Both URLs get the logged-in user's id as `user` (the server checks it is the owner).
// No picture (or it fails to load) -> the first letter of `name` on the `background` colour.
const props = defineProps({
  src: { type: String, default: '' },
  name: { type: String, default: '' },
  size: { type: String, default: '160px' },
  background: { type: String, default: 'linear-gradient(120deg, var(--ocean), var(--aqua))' },
  editable: Boolean,
  uploadUrl: { type: String, default: '' },
  removeUrl: { type: String, default: '' },
})
const emit = defineEmits(['uploaded', 'removed', 'error'])

const broken = ref(false)
watch(() => props.src, () => (broken.value = false))
const showPhoto = computed(() => !!props.src && !broken.value)
const initial = computed(() => (props.name || '?').trim().charAt(0).toUpperCase())

const busy = ref(false)
const fileInput = ref(null)
const menuOpen = ref(false)
const firstMenuButton = ref(null)
watch(menuOpen, async (open) => {
  if (!open) return
  await nextTick()
  firstMenuButton.value?.focus() // keyboard users land inside the box (Esc closes it)
})

function chooseNewPhoto() {
  menuOpen.value = false
  fileInput.value.click()
}

async function upload(event) {
  const file = event.target.files[0]
  event.target.value = '' // so choosing the same file again still triggers a change
  if (!file) return
  if (!file.type.startsWith('image/')) return emit('error', 'Please choose an image file.')
  if (file.size > 5 * 1024 * 1024) return emit('error', 'That image is too big (max 5MB).')
  emit('error', '')
  busy.value = true
  try {
    const form = new FormData()
    form.append('user', currentUser.value._id)
    form.append('image', file)
    const res = await axios.post(props.uploadUrl, form)
    emit('uploaded', res.data)
  } catch (err) {
    emit('error', err.response?.data?.message || 'Could not upload the picture. Please try again.')
  } finally {
    busy.value = false
  }
}

async function remove() {
  menuOpen.value = false
  emit('error', '')
  busy.value = true
  try {
    const res = await axios.delete(props.removeUrl, { data: { user: currentUser.value._id } })
    emit('removed', res.data)
  } catch (err) {
    emit('error', err.response?.data?.message || 'Could not remove the picture. Please try again.')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="avatar-wrap" :style="{ '--avatar-size': size }">
    <img v-if="showPhoto" :src="src" :alt="`${name} profile picture`" class="avatar" @error="broken = true" />
    <div v-else class="avatar avatar-letter" :style="{ background }" aria-hidden="true">{{ initial }}</div>

    <template v-if="editable">
      <button type="button" class="avatar-edit" :disabled="busy" aria-label="Change profile photo" aria-haspopup="dialog"
        @click="menuOpen = true">
        <svg width="22" height="22" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
          <path d="M15 12a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h1.172a3 3 0 0 0 2.12-.879l.83-.828A1 1 0 0 1 6.827 3h2.344a1 1 0 0 1 .707.293l.828.828A3 3 0 0 0 12.828 5H14a1 1 0 0 1 1 1zM2 4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-1.172a2 2 0 0 1-1.414-.586l-.828-.828A2 2 0 0 0 9.172 2H6.828a2 2 0 0 0-1.414.586l-.828.828A2 2 0 0 1 3.172 4z" />
          <path d="M8 11a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5m0 1a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7M3 6.5a.5.5 0 1 1-1 0 .5.5 0 0 1 1 0" />
        </svg>
        <span>{{ busy ? 'Saving...' : 'Change' }}</span>
      </button>
      <input ref="fileInput" type="file" accept="image/*" class="d-none" @change="upload" />

      <!-- "Change Profile Photo" box (like Instagram). Click outside or press Esc to close -->
      <Teleport to="body">
        <div v-if="menuOpen" class="photo-menu-shade" @click.self="menuOpen = false" @keydown.esc="menuOpen = false">
          <div class="photo-menu" role="dialog" aria-modal="true" aria-labelledby="photo-menu-title">
            <h2 id="photo-menu-title" class="photo-menu-title">Change Profile Photo</h2>
            <button ref="firstMenuButton" type="button" class="photo-menu-option upload" @click="chooseNewPhoto">Upload Photo</button>
            <button v-if="showPhoto" type="button" class="photo-menu-option remove" @click="remove">Remove Current Photo</button>
            <button type="button" class="photo-menu-option" @click="menuOpen = false">Cancel</button>
          </div>
        </div>
      </Teleport>
    </template>
  </div>
</template>

<style scoped>
.avatar-wrap {
  position: relative;
  flex-shrink: 0;
  width: var(--avatar-size);
  height: var(--avatar-size);
}
.avatar {
  display: block;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  object-fit: cover;
  background: var(--tile);
}
.avatar-letter {
  display: grid;
  place-items: center;
  font-size: calc(var(--avatar-size) * 0.4);
  font-weight: 700;
  color: #fff;
}
/* dark overlay with "Change" on hover / focus */
.avatar-edit {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
  border: 0;
  border-radius: 50%;
  background: rgba(var(--navy-rgb), 0.55);
  color: #fff;
  font-size: 0.85rem;
  font-weight: 600;
  opacity: 0;
  transition: opacity 0.15s ease;
}
.avatar-edit:hover,
.avatar-edit:focus-visible,
.avatar-edit:disabled {
  opacity: 1;
}
@media (hover: none) {
  .avatar-edit { opacity: 0.85; } /* phones: no hover, so always show it */
}

/* ---------- "Change Profile Photo" box ---------- */
.photo-menu-shade {
  position: fixed;
  inset: 0;
  z-index: 1100; /* above the sidebar drawer */
  display: grid;
  place-items: center;
  padding: 1rem;
  background: rgba(0, 0, 0, 0.55);
}
.photo-menu {
  width: min(400px, 100%);
  overflow: hidden;
  border-radius: 1.25rem;
  background: var(--surface);
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.25);
  text-align: center;
}
.photo-menu-title {
  margin: 0;
  padding: 1.6rem 1rem 1.4rem;
  font-size: 1.2rem;
  font-weight: 500;
  color: var(--ink);
}
.photo-menu-option {
  display: block;
  width: 100%;
  padding: 0.9rem 1rem;
  border: 0;
  border-top: 1px solid var(--line);
  background: none;
  font-size: 0.95rem;
  color: var(--ink);
}
.photo-menu-option:hover,
.photo-menu-option:focus-visible {
  background: var(--surface-hover);
  outline: none;
}
.photo-menu-option.upload {
  font-weight: 700;
  color: var(--ocean);
}
.photo-menu-option.remove {
  font-weight: 700;
  color: var(--rose);
}
</style>
