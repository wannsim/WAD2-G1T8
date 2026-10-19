<script setup>
import { ref, computed } from 'vue'
import { formatPrice } from '@/utils/format'
import FavouriteButton from './FavouriteButton.vue'

// Shared card used by Browse, FYP, Favourites, Shop pages.
//   <ProductCard :product="p" />
//   <ProductCard :product="p" :reason="'Matches your interests'">   <- optional "Why recommended?"
//   <ProductCard :product="p" favourite />   <- ♥ save button on the photo
//       <button>extra buttons go in the slot</button>
//   </ProductCard>
const props = defineProps({
  product: Object,
  reason: String,
  favourite: Boolean,
})

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
        <RouterLink :to="`/products/${product._id}`" class="card-title fw-bold">{{ product.name }}</RouterLink>
        <p v-if="shopName" class="text-muted small mb-1">
          {{ shopName }}<span v-if="product.shop.nearestMrt"> &middot; {{ product.shop.nearestMrt }} MRT</span>
        </p>
        <p class="fw-bold mb-2">
          {{ formatPrice(product.price) }}
          <span class="text-muted small fw-normal">/ {{ product.unit }}</span>
        </p>

        <details v-if="reason" class="small mb-2">
          <summary>Why recommended?</summary>
          {{ reason }}
        </details>

      <!-- extra buttons from the page using the card (e.g. ♥ save, Remove, Edit) -->
      <div class="mt-auto d-flex justify-content-between align-items-center gap-2">
        <slot></slot>
      </div>
      </div>
    </div>
    <!-- Hover details view -->
    <div class="card-preview">
      <div class="preview-content">
        <h5>{{ product.name }}</h5>

        <p class="fw-bold">
          {{ formatPrice(product.price) }}
          <span class="fw-normal">/ {{ product.unit }}</span>
        </p>

        <p class="description">
          {{ product.description || 'No description available.' }}
        </p>

        <div v-if="product.shop" class="small mb-3">
          <p class="mb-1">
            <strong>Shop:</strong> {{ product.shop.name }}
          </p>

          <p v-if="product.shop.nearestMrt" class="mb-1">
            <strong>Nearest MRT:</strong> {{ product.shop.nearestMrt }}
          </p>

          <div v-if="product.shop.stats">
            <StarRating :value="product.shop.stats.avgRating" />
          </div>
        </div>

        <RouterLink :to="`/products/${product._id}`" class="btn btn-brand btn-sm mt-auto">
          View full details
        </RouterLink>
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

.card-summary {
  height: 100%;
}

.card-summary .card-body {
  transition: opacity 0.2s ease;
}

.product-img {
  height: 180px;
  object-fit: cover;
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
}

.card-preview {
  /* covers only the text under the photo, so the carousel and ♥ stay clickable */
  position: absolute;
  inset: 180px 0 0 0;
  z-index: 2;
  padding: 1rem;
  background: white;

  opacity: 0;
  visibility: hidden;
  transform: translateY(8px);
  transition:
    opacity 0.2s ease,
    transform 0.2s ease,
    visibility 0.2s ease;

  overflow-y: auto;
}

.preview-content {
  min-height: 100%;
  display: flex;
  flex-direction: column;
}

.description {
  font-size: 0.9rem;
  line-height: 1.4;
}

/* keyboard users: open when tabbing into the text/buttons, but not after clicking a photo arrow */
.product-card:hover .card-preview,
.product-card:has(.card-body:focus-within) .card-preview,
.card-preview:focus-within {
  opacity: 1;
  visibility: visible;
  transform: translateY(0);
}

.product-card:hover .card-body {
  opacity: 0;
}
</style>