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
const pop = ref(false) // little "pop" when saving
const error = ref(false)
const saved = computed(() => !!currentUser.value && savedIds.value.includes(props.productId))

onMounted(loadSavedIds)

async function toggle() {
  if (!currentUser.value) {
    router.push('/login')
    return
  }
  error.value = false
  const willSave = !saved.value
  pop.value = false
  if (willSave) requestAnimationFrame(() => (pop.value = true))
  try {
    await toggleSaved(props.productId) // the ♥ has already changed; this only waits for the server
  } catch (err) {
    error.value = true // ♥ went back; shake so the buyer notices
    setTimeout(() => (error.value = false), 600)
    console.log(err.message)
  }
}
</script>

<template>
  <button type="button" class="fav-btn" :class="{ saved, pop, error }"
    :aria-label="saved ? 'Remove from favourites' : 'Add to favourites'" :aria-pressed="saved" @click.stop.prevent="toggle" @animationend="pop = false">
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
.fav-btn.pop {
  animation: pop 0.3s ease;
}
.fav-btn.error {
  animation: shake 0.4s ease;
}
@keyframes pop {
  50% { transform: scale(1.3); }
}
@keyframes shake {
  25% { transform: translateX(-3px); }
  75% { transform: translateX(3px); }
}
@media (prefers-reduced-motion: reduce) {
  .fav-btn.pop,
  .fav-btn.error {
    animation: none;
  }
}
</style>
