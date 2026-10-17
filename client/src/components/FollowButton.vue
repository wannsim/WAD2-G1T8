<script setup>
import { ref, computed, watch } from 'vue'
import axios from 'axios'
import { API_URL } from '@/utils/config'
import { currentUser } from '@/utils/auth'

// Follow / Unfollow button for a shop. Used on the product page and the shop page.
//   <FollowButton :shop="shop" />    shop needs _id, owner, followers
const props = defineProps({
  shop: Object,
})

const following = ref(false)
const followerCount = ref(0)
const busy = ref(false)
const error = ref('')

watch(
  () => props.shop,
  (shop) => {
    const followers = (shop?.followers || []).map(String)
    following.value = !!currentUser.value && followers.includes(currentUser.value._id)
    followerCount.value = followers.length
  },
  { immediate: true }
)

// sellers can't follow their own shop
const isOwnShop = computed(() => !!currentUser.value && String(props.shop?.owner) === currentUser.value._id)

async function toggleFollow() {
  error.value = ''
  busy.value = true
  try {
    const response = await axios.post(`${API_URL}/shops/${props.shop._id}/follow`, { user: currentUser.value._id })
    following.value = response.data.following
    followerCount.value = response.data.followerCount
  } catch (err) {
    error.value = err.response?.data?.message || err.message
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <span class="d-inline-flex align-items-center gap-2 flex-wrap">
    <template v-if="!isOwnShop">
      <button
        v-if="currentUser"
        type="button"
        class="btn btn-sm"
        :class="following ? 'btn-secondary' : 'btn-outline-secondary'"
        :disabled="busy"
        @click="toggleFollow"
      >
        {{ following ? '✓ Following' : '+ Follow' }}
      </button>
      <RouterLink v-else to="/login" class="btn btn-sm btn-outline-secondary">+ Follow</RouterLink>
    </template>
    <span class="small text-muted">{{ followerCount }} {{ followerCount === 1 ? 'follower' : 'followers' }}</span>
    <span v-if="error" class="small text-danger">{{ error }}</span>
  </span>
</template>
