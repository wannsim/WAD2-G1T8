<script setup>
import { ref, computed, watch } from 'vue'
import axios from 'axios'
import { API_URL } from '@/utils/config'
import { currentUser } from '@/utils/auth'
import FollowButton from './FollowButton.vue'

// Channel-style header for a shop (like a YouTube channel): banner, round profile picture, name,
// "@handle · followers · products · rating", one-line description, Follow button.
// Used by the public shop page (ShopView) and the seller's own My shop page (MyShopView).
//   <ShopHeader :shop="shop" :product-count="products.length" :is-owner="isOwner" @more="...">
//     <template #actions> owner-only buttons </template>
//   </ShopHeader>
// The shop owner can click the profile picture to upload a new one (POST /shops/:id/avatar).
const props = defineProps({
  shop: { type: Object, required: true },
  productCount: { type: Number, default: 0 },
  isOwner: Boolean,
})
// 'more' = "...more" was clicked (the shop page opens its About tab; otherwise the description just expands)
const emit = defineEmits(['more'])

// banner + letter-avatar colour: picked from the shop id, so each shop always gets the same one
const BANNERS = [
  'linear-gradient(120deg, #2f63e0, #36b3cc)',
  'linear-gradient(120deg, #e0607e, #f0b54a)',
  'linear-gradient(120deg, #18204a, #2f63e0)',
  'linear-gradient(120deg, #23899f, #7fd3b0)',
  'linear-gradient(120deg, #8b5cf6, #e0607e)',
]
const bannerColour = computed(() => {
  const sum = [...String(props.shop._id || '')].reduce((total, ch) => total + ch.charCodeAt(0), 0)
  return BANNERS[sum % BANNERS.length]
})
const initial = computed(() => (props.shop.name || '?').trim().charAt(0).toUpperCase())
const handle = computed(() => (props.shop.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 30) || 'shop')
const description = computed(() =>
  props.shop.description || (props.shop.nearestMrt ? `Home business near ${props.shop.nearestMrt} MRT` : 'Homemade with love'))
const expanded = ref(false)
function onMore() {
  expanded.value = !expanded.value
  emit('more')
}

const followerCount = ref(0)
watch(() => props.shop.followers, (followers) => (followerCount.value = (followers || []).length), { immediate: true })

// ---------- profile picture ----------
// ?v= changes whenever a new picture is uploaded, so the browser doesn't show the old cached one
const avatarUpdatedAt = ref(null)
watch(() => props.shop.avatarUpdatedAt, (value) => (avatarUpdatedAt.value = value || null), { immediate: true })
const avatarUrl = computed(() =>
  avatarUpdatedAt.value ? `${API_URL}/shops/${props.shop._id}/avatar?v=${new Date(avatarUpdatedAt.value).getTime()}` : '')
const avatarInput = ref(null)
const avatarBusy = ref(false)
const avatarError = ref('')

async function uploadAvatar(event) {
  const file = event.target.files[0]
  event.target.value = '' // so choosing the same file again still triggers a change
  if (!file) return
  avatarError.value = ''
  if (!file.type.startsWith('image/')) return (avatarError.value = 'Please choose an image file.')
  if (file.size > 5 * 1024 * 1024) return (avatarError.value = 'That image is too big (max 5MB).')
  avatarBusy.value = true
  try {
    const form = new FormData()
    form.append('user', currentUser.value._id)
    form.append('image', file)
    const res = await axios.post(`${API_URL}/shops/${props.shop._id}/avatar`, form)
    avatarUpdatedAt.value = res.data.avatarUpdatedAt
  } catch (err) {
    avatarError.value = err.response?.data?.message || 'Could not upload the picture. Please try again.'
  } finally {
    avatarBusy.value = false
  }
}

async function removeAvatar() {
  avatarError.value = ''
  avatarBusy.value = true
  try {
    await axios.delete(`${API_URL}/shops/${props.shop._id}/avatar`, { data: { user: currentUser.value._id } })
    avatarUpdatedAt.value = null
  } catch (err) {
    avatarError.value = err.response?.data?.message || 'Could not remove the picture. Please try again.'
  } finally {
    avatarBusy.value = false
  }
}
</script>

<template>
  <div class="banner" :style="{ background: bannerColour }" aria-hidden="true"></div>

  <div class="profile-head">
    <div class="avatar-wrap">
      <img v-if="avatarUrl" :src="avatarUrl" :alt="`${shop.name} profile picture`" class="avatar" @error="avatarUpdatedAt = null" />
      <div v-else class="avatar avatar-letter" :style="{ background: bannerColour }" aria-hidden="true">{{ initial }}</div>
      <!-- shop owner: click the picture to upload a new one -->
      <template v-if="isOwner">
        <button type="button" class="avatar-edit" :disabled="avatarBusy" aria-label="Change profile picture" @click="avatarInput.click()">
          <svg width="22" height="22" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
            <path d="M15 12a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h1.172a3 3 0 0 0 2.12-.879l.83-.828A1 1 0 0 1 6.827 3h2.344a1 1 0 0 1 .707.293l.828.828A3 3 0 0 0 12.828 5H14a1 1 0 0 1 1 1zM2 4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-1.172a2 2 0 0 1-1.414-.586l-.828-.828A2 2 0 0 0 9.172 2H6.828a2 2 0 0 0-1.414.586l-.828.828A2 2 0 0 1 3.172 4z" />
            <path d="M8 11a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5m0 1a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7M3 6.5a.5.5 0 1 1-1 0 .5.5 0 0 1 1 0" />
          </svg>
          <span>{{ avatarBusy ? 'Uploading...' : 'Change' }}</span>
        </button>
        <input ref="avatarInput" type="file" accept="image/*" class="d-none" @change="uploadAvatar" />
      </template>
    </div>

    <div class="profile-info">
      <h1 class="shop-name">{{ shop.name }}</h1>
      <p class="meta">
        <strong>@{{ handle }}</strong>
        <span>&middot; {{ followerCount }} {{ followerCount === 1 ? 'follower' : 'followers' }}</span>
        <span>&middot; {{ productCount }} {{ productCount === 1 ? 'product' : 'products' }}</span>
        <span v-if="shop.stats?.reviewCount">&middot; {{ shop.stats.avgRating.toFixed(1) }} &#9733; ({{ shop.stats.reviewCount }})</span>
      </p>
      <p class="tagline">
        <span :class="{ 'clamp-1': !expanded }">{{ description }}</span>
        <button type="button" class="more-btn" :aria-expanded="expanded" @click="onMore">{{ expanded ? 'less' : '...more' }}</button>
      </p>
      <div class="d-flex flex-wrap align-items-center gap-2">
        <FollowButton :shop="shop" @change="followerCount = $event.followerCount" />
        <template v-if="isOwner">
          <slot name="actions"></slot>
          <button v-if="avatarUrl" type="button" class="btn btn-link btn-sm text-muted" :disabled="avatarBusy" @click="removeAvatar">
            Remove picture
          </button>
        </template>
      </div>
      <p v-if="isOwner && !avatarUrl" class="small text-muted mt-2 mb-0">Tip: click the circle to upload your profile picture.</p>
      <p v-if="avatarError" class="small text-danger mt-2 mb-0">{{ avatarError }}</p>
    </div>
  </div>
</template>

<style scoped>
.banner {
  height: clamp(110px, 16vw, 200px);
  border-radius: 1.5rem;
}
.profile-head {
  display: flex;
  align-items: center;
  gap: 1.75rem;
  padding: 1.5rem 0.25rem 1.25rem;
}
.avatar-wrap {
  position: relative;
  flex-shrink: 0;
}
.avatar {
  display: block;
  width: 160px;
  height: 160px;
  border-radius: 50%;
  object-fit: cover;
  background: var(--tile);
}
.avatar-letter {
  display: grid;
  place-items: center;
  font-size: 4rem;
  font-weight: 700;
  color: #fff;
}
/* owner: dark overlay with "Change" on hover / focus */
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
.profile-info {
  flex: 1;
  min-width: 0;
}
.shop-name {
  margin: 0 0 0.35rem;
  font-size: clamp(1.8rem, 3.2vw, 2.6rem);
  font-weight: 700;
  color: var(--navy);
  overflow-wrap: anywhere;
}
.meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin: 0 0 0.6rem;
  color: var(--muted);
}
.meta strong {
  color: var(--ink);
  font-weight: 600;
}
.tagline {
  display: flex;
  align-items: baseline;
  gap: 0.3rem;
  max-width: 640px;
  margin: 0 0 1rem;
  color: var(--muted);
}
.tagline > span {
  min-width: 0;
  white-space: pre-line;
}
.more-btn {
  flex-shrink: 0;
  padding: 0;
  border: 0;
  background: none;
  font-weight: 600;
  color: var(--ink);
}
/* owner buttons passed in through the "actions" slot */
.profile-info :slotted(.owner-btn) {
  border-radius: 999px;
  padding: 0.55rem 1.4rem;
  font-weight: 600;
}

/* phones: picture above the name, like the YouTube app */
@media (max-width: 575.98px) {
  .profile-head {
    flex-direction: column;
    align-items: flex-start;
    gap: 1rem;
  }
  .profile-info {
    align-self: stretch; /* full width, so long text wraps / clamps instead of widening the page */
  }
  .avatar {
    width: 96px;
    height: 96px;
  }
  .avatar-letter {
    font-size: 2.5rem;
  }
}
</style>
