<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { currentUser } from '@/utils/auth'
import { savedIds, loadSavedIds, toggleSaved } from '@/utils/favourites'

// Round ♥ button to save / un-save a product. Used on ProductCard (favourite prop).
//   <FavouriteButton :product-id="product._id" />
const props = defineProps({
  productId: String,
})

const router = useRouter()
const busy = ref(false)
const saved = computed(() => !!currentUser.value && savedIds.value.includes(props.productId))

onMounted(loadSavedIds)

async function toggle() {
  if (!currentUser.value) {
    router.push('/login')
    return
  }
  busy.value = true
  try {
    await toggleSaved(props.productId)
  } catch (err) {
    console.log(err.message)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <button type="button" class="fav-btn" :class="{ saved }" :disabled="busy"
    :aria-label="saved ? 'Remove from favourites' : 'Add to favourites'" :aria-pressed="saved" @click="toggle">
    {{ saved ? '♥' : '♡' }}
  </button>
</template>

<style scoped>
.fav-btn {
  width: 34px;
  height: 34px;
  border: none;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.9);
  color: var(--muted);
  font-size: 1.15rem;
  line-height: 1;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.2);
  transition: transform 0.15s ease;
}

.fav-btn:hover {
  transform: scale(1.1);
}

.fav-btn.saved {
  color: var(--rose);
}
</style>
