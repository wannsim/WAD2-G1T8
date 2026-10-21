<script setup>
import { ref, computed } from 'vue'
import { formatPrice } from '@/utils/format'
import FavouriteButton from './FavouriteButton.vue'

// Shared card used by Browse, FYP, Favourites, Shop pages.
//   <ProductCard :product="p" />
//   <ProductCard :product="p" :reason="'Matches your interests'">   <- optional "Why recommended?"
//   <ProductCard :product="p" favourite />   <- ♥ save button on the photo
//   <ProductCard :product="p" @open="..." />   <- fires when the buyer clicks through to the product page
//       <button>extra buttons go in the slot</button>
//   </ProductCard>
const props = defineProps({
  product: Object,
  reason: String,
  favourite: Boolean,
})
// 'open' = the buyer clicked through to the product page (FYP logs this as a "click")
defineEmits(['open'])

// product.shop is an object when the server populated it, otherwise just an id
const shopName = computed(() => props.product.shop?.name || '')

// photo carousel: the server sends imageUrls when it knows how many photos there are
const images = computed(() => props.product.imageUrls?.length ? props.product.imageUrls : [props.product.imageUrl || '/placeholder.svg'])
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

// no photo / broken link -> show the placeholder instead of an empty box
function useFallbackImage(event) {
  if (!event.target.src.endsWith('/placeholder.svg')) event.target.src = '/placeholder.svg'
}
</script>

<template>
  <!-- <div class="card h-100 shadow-sm"> -->
  <div class="product-card card h-100 shadow-sm">
    <div class="card-summary">
      <div class="carousel-box" @touchstart.passive="onTouchStart" @touchend="onTouchEnd">
        <div class="carousel-track" :style="{ transform: `translateX(-${current * 100}%)` }">
          <!-- lazy: only download pictures that are on (or near) the screen -->
          <img v-for="(src, i) in images" :key="src" :src="src" class="card-img-top product-img"
            :alt="`${product.name} photo ${i + 1}`" loading="lazy" decoding="async" @error="useFallbackImage" />
        </div>

        <template v-if="images.length > 1">
          <button type="button" class="carousel-arrow prev" aria-label="Previous photo"
            @click="showImage(current - 1)">&lsaquo;</button>
          <button type="button" class="carousel-arrow next" aria-label="Next photo"
            @click="showImage(current + 1)">&rsaquo;</button>
          <div class="carousel-dots">
            <button v-for="(src, i) in images" :key="src" type="button" class="dot" :class="{ active: i === current }"
              :aria-label="`Show photo ${i + 1}`" @click="showImage(i)"></button>
          </div>
        </template>

        <FavouriteButton v-if="favourite" :product-id="product._id" class="fav-on-photo" />
      </div>
      <div class="card-body d-flex flex-column">
        <RouterLink :to="`/products/${product._id}`" class="card-title fw-bold clamp-2" @click="$emit('open')">{{ product.name }}</RouterLink>
        <p v-if="shopName" class="text-muted small mb-1 clamp-1">
          {{ shopName }}<span v-if="product.shop.nearestMrt"> &middot; {{ product.shop.nearestMrt }} MRT</span>
        </p>
        <p class="fw-bold mb-2">
          {{ formatPrice(product.price) }}
          <span class="text-muted small fw-normal">/ {{ product.unit }}</span>
        </p>

        <details v-if="reason" class="small mb-2 reason">
          <summary>Why recommended?</summary>
          {{ reason }}
        </details>

        <div class="mt-auto">
          <RouterLink :to="`/products/${product._id}`" class="btn btn-brand btn-sm w-100 mb-2" @click="$emit('open')">
            View full details
          </RouterLink>
          <!-- extra buttons from the page using the card (e.g. ♥ save, Remove, Edit) -->
          <div class="d-flex justify-content-between align-items-center gap-2">
            <slot></slot>
          </div>
        </div>
      </div>
    </div>

  </div>
</template>

<style scoped>
.product-card {
  position: relative;
  overflow: hidden;
  min-width: 0;
}

/* body stretches to fill the card, so "View full details" (mt-auto) sits at the bottom
   and lines up across a row even when one card's "Why recommended?" is open */
.card-summary {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.card-summary .card-body {
  flex: 1 1 auto;
}

.carousel-box {
  position: relative;
  overflow: hidden;
  touch-action: pan-y; /* page can still scroll up/down while swiping photos */
}

.carousel-track {
  display: flex;
  transition: transform 0.3s ease;
}

.carousel-track .product-img {
  flex: 0 0 100%;
  width: 100%;
}

.carousel-arrow {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.85);
  font-size: 1.2rem;
  line-height: 1;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.carousel-arrow.prev { left: 6px; }
.carousel-arrow.next { right: 6px; }

/* arrows show on hover; always shown on touch screens (no hover there) */
.carousel-box:hover .carousel-arrow,
.carousel-arrow:focus-visible { opacity: 1; }
@media (hover: none) {
  .carousel-arrow { opacity: 1; }
}

.carousel-dots {
  position: absolute;
  bottom: 6px;
  left: 0;
  right: 0;
  display: flex;
  justify-content: center;
  gap: 5px;
}

.dot {
  width: 7px;
  height: 7px;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.6);
}

.dot.active { background: white; }

.fav-on-photo {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 1;
}

.reason summary {
  cursor: pointer;
  color: #c2410c;
}
</style>
