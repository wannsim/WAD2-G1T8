<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import axios from 'axios'
import { API_URL } from '@/utils/config'
import { currentUser } from '@/utils/auth'
import { formatPrice, formatDateTime, capitalize } from '@/utils/format'
import FollowButton from '@/components/FollowButton.vue'

// Owner: Member 3 - /products/:id
const route = useRoute()
const product = ref(null)

const router = useRouter()
const chatError = ref('')

async function chatWithSeller() {
  chatError.value = ''
  try {
    const response = await axios.post(`${API_URL}/chats/start`, {
      buyer: currentUser.value._id,
      shop: product.value.shop._id,
    })
    router.push(`/chats/${response.data._id}`) // opens the chat tab with this chat open
  } catch (error) {
    chatError.value = error.response?.data?.message || error.message
  }
}

const loading = ref(true)
const loadError = ref('')

// photo gallery: the server sends one imageUrl per photo in imageUrls
const images = computed(() => product.value?.imageUrls?.length ? product.value.imageUrls : [product.value?.imageUrl || '/placeholder.svg'])
const current = ref(0)

function showImage(index) {
  const count = images.value.length
  current.value = (index + count) % count // wrap around at both ends
}

// swipe left / right on phones
let touchStartX = null
function onTouchStart(event) {
  touchStartX = event.touches[0].clientX
}
function onTouchEnd(event) {
  if (touchStartX === null) return
  const distance = event.changedTouches[0].clientX - touchStartX
  if (Math.abs(distance) > 40) showImage(current.value + (distance < 0 ? 1 : -1))
  touchStartX = null
}

function useFallbackImage(event) {
  if (!event.target.src.endsWith('/placeholder.svg')) event.target.src = '/placeholder.svg'
}

onMounted(async () => {
  try {
    const response = await axios.get(`${API_URL}/products/${route.params.id}`)
    product.value = response.data
  } catch (error) {
    loadError.value = error.response?.status === 404
      ? 'This product could not be found. It may have been removed by the seller.'
      : 'Could not load this product. Please try again.'
    console.log(error.message)
  } finally {
    loading.value = false
  }

  // tell the FYP that this buyer viewed this product (Member 4 uses this).
  // Runs in the background so it never stops the page from showing.
  if (product.value && currentUser.value) {
    axios
      .post(`${API_URL}/feed/interactions`, {
        user: currentUser.value._id,
        product: product.value._id,
        shop: product.value.shop?._id,
        type: 'view',
      })
      .catch((error) => console.log(error.message))
  }
})
</script>

<template>
  <p v-if="loading" class="text-muted">Loading...</p>
  <div v-else-if="loadError" class="alert alert-warning">
    {{ loadError }} <RouterLink to="/browse">Back to browse</RouterLink>
  </div>
  <div v-else-if="product" class="row g-4 align-items-start">
    <div class="col-md-6">
      <!-- fixed square frame so every product lines up the same, whatever the photo's shape -->
      <div class="product-image-frame" @touchstart.passive="onTouchStart" @touchend="onTouchEnd">
        <img :src="images[current]" :alt="`${product.name} photo ${current + 1}`" @error="useFallbackImage" />
        <template v-if="images.length > 1">
          <button type="button" class="gallery-arrow prev" aria-label="Previous photo" @click="showImage(current - 1)">&lsaquo;</button>
          <button type="button" class="gallery-arrow next" aria-label="Next photo" @click="showImage(current + 1)">&rsaquo;</button>
          <span class="gallery-count">{{ current + 1 }} / {{ images.length }}</span>
        </template>
      </div>
      <!-- every photo as a thumbnail - click one to show it above -->
      <div v-if="images.length > 1" class="d-flex flex-wrap gap-2 mt-2">
        <button v-for="(src, i) in images" :key="src" type="button" class="gallery-thumb" :class="{ active: i === current }"
          :aria-label="`Show photo ${i + 1}`" @click="showImage(i)">
          <img :src="src" alt="" loading="lazy" @error="useFallbackImage" />
        </button>
      </div>
    </div>
    <div class="col-md-6 product-info">
      <h2 class="page-title mb-1">{{ product.name }}</h2>
      <div v-if="product.category || product.customisable" class="d-flex flex-wrap gap-1 mb-2">
        <span v-if="product.category" class="badge text-bg-light border">{{ capitalize(product.category) }}</span>
        <span v-if="product.customisable" class="badge text-bg-light border">Customisable</span>
      </div>
      <!-- the shop can be missing if it was deleted - don't crash the page -->
      <p v-if="product.shop" class="text-muted mb-2">
        by <RouterLink :to="`/shops/${product.shop._id}`">{{ product.shop.name }}</RouterLink>
        &middot; <StarRating :value="product.shop.stats?.avgRating" />
        <span>({{ product.shop.stats?.reviewCount || 0 }})</span>
        <span v-if="product.shop.nearestMrt"> &middot; {{ product.shop.nearestMrt }} MRT</span>
      </p>
      <p v-else class="text-muted mb-2">This seller's shop is no longer available.</p>
      <div v-if="product.shop" class="mb-3">
        <FollowButton :shop="product.shop" />
      </div>
      <p class="fs-3 fw-bold mb-4">{{ formatPrice(product.price) }} <span class="fs-6 text-muted fw-normal">/ {{ product.unit }}</span></p>

      <div class="info-section">
        <h6>Description</h6>
        <p class="mb-0">{{ product.description || 'No description provided.' }}</p>
        <p v-if="product.tags?.length" class="small text-muted mt-2 mb-0">
          {{ product.tags.map((t) => '#' + t).join(' ') }}
        </p>
      </div>

      <div class="info-section">
        <h6>Available slots</h6>
        <ul v-if="product.orderSlots && product.orderSlots.length" class="mb-0">
          <li v-for="slot in product.orderSlots" :key="slot._id">{{ formatDateTime(slot.start) }}</li>
        </ul>
        <p v-else class="text-muted mb-0">No slots listed - ask the seller.</p>
      </div>

      <!-- <RouterLink v-if="currentUser && currentUser.role === 'buyer'" :to="`/order/new/${product._id}`" class="btn btn-brand">
        Request order
      </RouterLink>
      <p v-else-if="!currentUser" class="text-muted">
        <RouterLink to="/login">Log in</RouterLink> as a buyer to order.
      </p> -->
      <div v-if="currentUser && currentUser.role === 'buyer' && product.shop" class="mt-4">
        <div class="d-flex gap-2">
          <RouterLink :to="`/order/new/${product._id}`" class="btn btn-brand btn-lg flex-fill">Request order</RouterLink>
          <button class="btn chatBtn btn-lg flex-fill" @click="chatWithSeller">Chat with seller</button>
        </div>
        <p v-if="chatError" class="text-danger small mt-2">{{ chatError }}</p>
      </div>
      <p v-else-if="!currentUser" class="text-muted mt-4">
        <RouterLink to="/login">Log in</RouterLink> as a buyer to order.
      </p>
    </div>
  </div>
</template>


<style scoped>
.product-image-frame {
  aspect-ratio: 1 / 1;
  width: 100%;
  background: #f5f5f5;
  border-radius: 0.5rem;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}

.product-image-frame {
  position: relative;
  touch-action: pan-y; /* page can still scroll up/down while swiping photos */
}

.product-image-frame img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.gallery-arrow {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 40px;
  height: 40px;
  border: none;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.9);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.2);
  font-size: 1.6rem;
  line-height: 1;
}

.gallery-arrow.prev { left: 10px; }
.gallery-arrow.next { right: 10px; }

.gallery-count {
  position: absolute;
  bottom: 10px;
  right: 10px;
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.55);
  color: white;
  font-size: 0.8rem;
}

.gallery-thumb {
  width: 72px;
  height: 72px;
  padding: 0;
  border: 2px solid transparent;
  border-radius: 0.375rem;
  overflow: hidden;
  background: #f5f5f5;
  opacity: 0.7;
}

.gallery-thumb.active {
  border-color: #c2410c;
  opacity: 1;
}

.gallery-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.info-section {
  padding: 1rem 0;
  border-top: 1px solid #e5e5e5;
}

.info-section h6 {
  font-weight: 600;
  margin-bottom: 0.5rem;
}

.chatBtn{
  color: #c2410c;
  border-color: #c2410c
}

.chatBtn:hover{
  color: #9a3412;
  border-color: #9a3412
}
</style>