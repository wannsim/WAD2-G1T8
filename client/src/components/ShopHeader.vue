<script setup>
import { ref, computed, watch } from 'vue'
import { API_URL } from '@/utils/config'
import { myShopAvatar } from '@/utils/layout'
import FollowButton from './FollowButton.vue'
import AvatarEditor from './AvatarEditor.vue'

// Channel-style header for a shop (like a YouTube channel): banner, round profile picture, name,
// "@handle · followers · products · rating", one-line description, Follow button.
// Used by the public shop page (ShopView) and the seller's own My shop page (MyShopView).
//   <ShopHeader :shop="shop" :product-count="products.length" :is-owner="isOwner" @more="...">
//     <template #actions> owner-only buttons </template>
//   </ShopHeader>
// The shop owner clicks the profile picture to change it (Instagram-style "Change Profile Photo" box:
// upload / remove / cancel - AvatarEditor, using POST + DELETE /shops/:id/avatar), and gets a Manage | Public page toggle
// in the top right to switch between My shop and the public shop page.
// The banner shows the profile picture (cropped to fit); shops without one get a colour picked from their id.
const props = defineProps({
  shop: { type: Object, required: true },
  productCount: { type: Number, default: 0 },
  isOwner: Boolean,
})
// 'more' = "...more" was clicked (the shop page opens its About tab; otherwise the description just expands)
const emit = defineEmits(['more'])

// banner + letter-avatar colour: picked from the shop id, so each shop always gets the same one
const BANNERS = [
  'linear-gradient(120deg, #24498a, #5b86c5)',
  'linear-gradient(120deg, #3f6aa8, #b4c9e8)',
  'linear-gradient(120deg, #13284b, #24498a)',
  'linear-gradient(120deg, #e3a63a, #f6d9b0)',
  'linear-gradient(120deg, #3f6aa8, #b4c9e8)',
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
// the seller's own shop: keep the top bar's avatar in step after an upload / removal
watch(avatarUrl, (url) => {
  if (props.isOwner) myShopAvatar.value = url
})
const avatarError = ref('')
</script>

<template>
  <!-- banner: the profile picture itself (cropped to fill the wide strip), or the shop's colour if there is no picture -->
  <div class="banner" :style="{ background: bannerColour }" aria-hidden="true">
    <div v-if="avatarUrl" class="banner-photo" :style="{ backgroundImage: `url(${avatarUrl})` }"></div>
  </div>

  <div class="profile-head">
    <!-- shop owner: click the picture -> "Change Profile Photo" box (like Instagram) -->
    <AvatarEditor :src="avatarUrl" :name="shop.name" :background="bannerColour" size="clamp(96px, 20vw, 160px)"
      :editable="isOwner" :upload-url="`${API_URL}/shops/${shop._id}/avatar`" :remove-url="`${API_URL}/shops/${shop._id}/avatar`"
      @uploaded="avatarUpdatedAt = $event.avatarUpdatedAt" @removed="avatarUpdatedAt = null" @error="avatarError = $event" />

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
        <slot v-if="isOwner" name="actions"></slot>
      </div>
      <p v-if="isOwner && !avatarUrl" class="small text-muted mt-2 mb-0">Tip: click the circle to add your profile photo.</p>
      <p v-if="avatarError" class="small text-danger mt-2 mb-0">{{ avatarError }}</p>
    </div>

    <!-- owner: switch between managing the shop and seeing it like a buyer (top right, same look as the List / Map toggle) -->
    <div v-if="isOwner" class="toggle-row">
      <nav class="view-toggle" aria-label="Manage your shop or see your public page">
        <RouterLink to="/seller/shop" class="toggle-option" active-class="active">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
            <path d="M9.405 1.05c-.413-1.4-2.397-1.4-2.81 0l-.1.34a1.464 1.464 0 0 1-2.105.872l-.31-.17c-1.283-.698-2.686.705-1.987 1.987l.169.311c.446.82.023 1.841-.872 2.105l-.34.1c-1.4.413-1.4 2.397 0 2.81l.34.1a1.464 1.464 0 0 1 .872 2.105l-.17.31c-.698 1.283.705 2.686 1.987 1.987l.311-.169a1.464 1.464 0 0 1 2.105.872l.1.34c.413 1.4 2.397 1.4 2.81 0l.1-.34a1.464 1.464 0 0 1 2.105-.872l.31.17c1.283.698 2.686-.705 1.987-1.987l-.169-.311a1.464 1.464 0 0 1 .872-2.105l.34-.1c1.4-.413 1.4-2.397 0-2.81l-.34-.1a1.464 1.464 0 0 1-.872-2.105l.17-.31c.698-1.283-.705-2.686-1.987-1.987l-.311.169a1.464 1.464 0 0 1-2.105-.872zM8 10.93a2.929 2.929 0 1 1 0-5.86 2.929 2.929 0 0 1 0 5.858z" />
          </svg>
          Manage
        </RouterLink>
        <RouterLink :to="`/shops/${shop._id}`" class="toggle-option" active-class="active">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
            <path d="M16 8s-3-5.5-8-5.5S0 8 0 8s3 5.5 8 5.5S16 8 16 8M1.173 8a13 13 0 0 1 1.66-2.043C4.12 4.668 5.88 3.5 8 3.5s3.879 1.168 5.168 2.457A13 13 0 0 1 14.828 8q-.086.13-.195.288c-.335.48-.83 1.12-1.465 1.755C11.879 11.332 10.119 12.5 8 12.5s-3.879-1.168-5.168-2.457A13 13 0 0 1 1.172 8z" />
            <path d="M8 5.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5M4.5 8a3.5 3.5 0 1 1 7 0 3.5 3.5 0 0 1-7 0" />
          </svg>
          Public page
        </RouterLink>
      </nav>
    </div>
  </div>
</template>

<style scoped>
.banner {
  position: relative;
  overflow: hidden;
  height: clamp(110px, 16vw, 200px);
  border-radius: 1.5rem;
}
/* the profile picture across the banner: fills the strip, and the top / bottom are cut off if it's too tall */
.banner-photo {
  position: absolute;
  inset: 0;
  background-size: cover;
  background-position: center;
}
.profile-head {
  display: flex;
  align-items: center;
  gap: 1.75rem;
  padding: 1.5rem 0.25rem 1.25rem;
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

/* Manage | Public page toggle (same as ViewToggle's List | Map); the page you're on is the white pill.
   Sits in the top right corner, just under the banner */
.toggle-row {
  align-self: flex-start;
  flex-shrink: 0;
  margin-left: auto;
}
.view-toggle {
  display: inline-flex;
  gap: 0.2rem;
  padding: 0.3rem;
  border-radius: 1.2rem;
  background: var(--tile);
}
.toggle-option {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.5rem 1.2rem;
  border-radius: 0.95rem;
  font-size: 0.9rem;
  font-weight: 500;
  color: var(--muted);
  text-decoration: none;
  transition: background 0.2s ease, color 0.2s ease, box-shadow 0.2s ease;
}
.toggle-option:hover {
  color: var(--navy);
}
.toggle-option.active {
  background: var(--surface);
  color: var(--navy);
  box-shadow: 0 4px 12px rgba(var(--navy-rgb), 0.1);
}

/* below ~992px there isn't room for the toggle beside the name: it goes on its own line above */
@media (max-width: 991.98px) {
  .profile-head {
    flex-wrap: wrap;
  }
  .toggle-row {
    order: -1;
    display: flex;
    justify-content: flex-end;
    width: 100%;
  }
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
}
</style>
