<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { formatPrice, capitalize } from '@/utils/format'
import FavouriteButton from './FavouriteButton.vue'

// Shared card used by Browse, FYP, Favourites, Shop pages.
//   <ProductCard :product="p" />      <- click anywhere on the card to open the product
//   <ProductCard :product="p" :reason="'Matches your interests'">   <- optional "Why recommended?"
//   <ProductCard :product="p" favourite />   <- ♥ save button on the photo
//   <ProductCard :product="p" :pinned="..." pinnable @toggle-pin="..." />   <- pin in the top right (a button for the shop owner)
//   <ProductCard :product="p" @open="..." />   <- fires when the buyer clicks through to the product page
//       <button>extra buttons go in the slot</button>
//   </ProductCard>
const props = defineProps({
  product: Object,
  reason: String,
  favourite: Boolean,
  pinned: Boolean, // pin icon in the top right corner of the card (shop page)
  pinnable: Boolean, // shop owner: that pin is a button -> emits 'toggle-pin'
  pinBusy: Boolean,
  noSwipe: Boolean, // inside a sideways-scrolling row: swiping scrolls the row, not the photos
})
// 'open' = the buyer clicked through to the product page (FYP logs this as a "click")
const emit = defineEmits(['open', 'toggle-pin'])

// bootstrap-icons pin-angle-fill / pin-angle
const PIN_FILLED = 'M9.828.722a.5.5 0 0 1 .354.146l4.95 4.95a.5.5 0 0 1 0 .707c-.48.48-1.072.588-1.503.588-.177 0-.335-.018-.46-.039l-3.134 3.134a6 6 0 0 1 .16 1.013c.046.702-.032 1.687-.72 2.375a.5.5 0 0 1-.707 0l-2.829-2.828-3.182 3.182c-.195.195-1.219.902-1.414.707s.512-1.22.707-1.414l3.182-3.182-2.828-2.829a.5.5 0 0 1 0-.707c.688-.688 1.673-.767 2.375-.72a6 6 0 0 1 1.013.16l3.134-3.133a3 3 0 0 1-.04-.461c0-.43.108-1.022.589-1.503a.5.5 0 0 1 .353-.146'
const PIN_OUTLINE = PIN_FILLED + 'm.122 2.112v-.002zm0-.002v.002a.5.5 0 0 1-.122.51L6.293 6.878a.5.5 0 0 1-.511.12H5.78l-.014-.004a5 5 0 0 0-.288-.076 5 5 0 0 0-.765-.116c-.422-.028-.836.008-1.175.15l5.51 5.509c.141-.34.177-.753.149-1.175a5 5 0 0 0-.192-1.054l-.004-.013v-.001a.5.5 0 0 1 .12-.512l3.536-3.535a.5.5 0 0 1 .532-.115l.096.022c.087.017.208.034.344.034q.172.002.343-.04L9.927 2.028q-.042.172-.04.343a1.8 1.8 0 0 0 .062.46z'
const router = useRouter()

// the "Why recommended?" hint sits above the card link (so its tooltip works), so it opens the product itself
function openProduct() {
  emit('open')
  router.push(`/products/${props.product._id}`)
}

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
  if (props.noSwipe) return
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
        <!-- shop owner: a Pin / Unpin button. Everyone else: just the pin icon on pinned products -->
        <button v-if="pinnable" type="button" class="feature-mark feature-toggle" :class="{ pinned, 'beside-fav': favourite }"
          :disabled="pinBusy" :data-label="pinned ? 'Unpin' : 'Pin'" :aria-label="pinned ? `Unpin ${product.name}` : `Pin ${product.name}`"
          :aria-pressed="pinned" @click="$emit('toggle-pin')">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path :d="pinned ? PIN_FILLED : PIN_OUTLINE" /></svg>
        </button>
        <span v-else-if="pinned" class="feature-mark pinned" :class="{ 'beside-fav': favourite }" title="Pinned by the seller" aria-label="Pinned">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path :d="PIN_FILLED" /></svg>
        </span>
      </div>
      <div class="card-body d-flex flex-column">
        <span class="card-label clamp-1">{{ product.category ? capitalize(product.category) : 'Homemade' }}</span>
        <!-- card-link stretches over the whole card: clicking anywhere opens the product -->
        <RouterLink :to="`/products/${product._id}`" class="card-title card-link clamp-2" @click="$emit('open')">{{ product.name }}</RouterLink>
        <p v-if="shopName" class="text-muted small mb-1 clamp-1">
          {{ shopName }}<span v-if="product.shop.nearestMrt"> &middot; {{ product.shop.nearestMrt }} MRT</span>
        </p>
        <!-- price as a blue pill, like the inspiration -->
        <div class="price-row mb-1">
          <span class="unit clamp-1">/ {{ product.unit }}</span>
          <span class="price-pill">{{ formatPrice(product.price) }}</span>
        </div>

        <!-- grey hint; the reason shows in a tooltip on hover (or keyboard focus) -->
        <div v-if="reason" class="reason mb-1">
          <span class="reason-hint" tabindex="0" :aria-label="`Why recommended: ${reason}`" @click="openProduct">
            <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
              <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14m0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16" />
              <path d="m8.93 6.588-2.29.287-.082.38.45.083c.294.07.352.176.288.469l-.738 3.468c-.194.897.105 1.319.808 1.319.545 0 1.178-.252 1.465-.598l.088-.416c-.2.176-.492.246-.686.246-.275 0-.375-.193-.304-.533zM9 4.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0" />
            </svg>
            Why recommended?
          </span>
          <span class="reason-tip" role="tooltip">{{ reason }}</span>
        </div>

        <!-- extra buttons from the page using the card (e.g. Remove, Edit) - these stay clickable on their own -->
        <div v-if="$slots.default" class="mt-auto card-actions d-flex justify-content-between align-items-center gap-2">
          <slot></slot>
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
  padding: 0.55rem; /* photo has its own rounded corners, inside the card's rounded shape */
  --bs-card-bg: transparent; /* like YouTube: no background until you hover */
  cursor: pointer;
  transition: background-color 0.18s ease;
}
/* hover: the rounded grey tile appears behind the photo + text */
.product-card:hover,
.product-card:has(.card-link:focus-visible) {
  --bs-card-bg: var(--tile);
}
.product-card:has(.card-link:focus-visible) {
  outline: 3px solid rgba(var(--ocean-rgb), 0.45);
  outline-offset: 2px;
}
/* the product name link covers the whole card (like Bootstrap's .stretched-link) */
.card-link::after {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 1;
}
.card-link:focus-visible {
  outline: none;
}
/* things with their own job sit above the card link */
.carousel-arrow,
.carousel-dots {
  z-index: 2; /* already positioned (absolute) */
}
.reason-hint,
.card-actions {
  position: relative;
  z-index: 2;
}
@media (prefers-reduced-motion: reduce) {
  .product-card { transition: none; }
}

.carousel-box {
  border-radius: 1.15rem;
}
.carousel-box :deep(.card-img-top),
.carousel-box .product-img {
  border-radius: 0; /* the box above rounds the corners */
}
.card-summary .card-body {
  padding: 0.6rem 0.5rem 0.25rem;
}
.card-label {
  font-size: 0.75rem;
  color: var(--muted);
}
.card-title {
  min-height: 0; /* short names don't keep an empty second line (tighter card) */
  font-size: 1.02rem;
  font-weight: 600;
  line-height: 1.25;
  margin-bottom: 0.15rem;
}
.price-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}
.price-row .unit {
  min-width: 0;
  font-size: 0.82rem;
  color: var(--muted);
}
.price-pill {
  flex-shrink: 0;
  padding: 0.4rem 0.95rem;
  border-radius: 999px;
  background: var(--ocean);
  box-shadow: 0 6px 14px rgba(var(--ocean-rgb), 0.3);
  font-size: 0.9rem;
  font-weight: 600;
  color: #fff;
}

/* body stretches to fill the card, so extra buttons (mt-auto) sit at the bottom
   and line up across a row */
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
  z-index: 2; /* above the card link */
}

/* pinned by the seller: pin in the top right corner (moves left if the ♥ is there) */
.feature-mark {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 2;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.92); /* not pinned (owner only): white with an outline pin */
  color: var(--ink-soft);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
  transition: transform 0.15s ease;
}
.feature-mark.pinned {
  background: var(--amber);
  color: var(--navy);
}
.feature-mark.beside-fav {
  right: 48px;
}
.feature-toggle:hover:not(:disabled) {
  color: var(--navy);
  transform: scale(1.08);
}
/* "Pin" / "Unpin" label under the button on hover */
.feature-toggle:hover:not(:disabled)::after,
.feature-toggle:focus-visible::after {
  content: attr(data-label);
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  padding: 2px 8px;
  border-radius: 4px;
  background: var(--navy);
  color: #fff;
  font-size: 0.75rem;
  white-space: nowrap;
  pointer-events: none;
}

.reason {
  position: relative;
}
.reason-hint {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.7rem;
  color: var(--muted); /* greyed out, small */
  cursor: help;
  border-radius: 4px;
}
.reason-hint:hover,
.reason-hint:focus-visible {
  color: var(--ink-soft);
  outline: none;
}
/* tooltip above the hint, kept inside the card */
.reason-tip {
  position: absolute;
  bottom: calc(100% + 6px);
  left: 0;
  z-index: 5;
  width: max-content;
  max-width: 100%;
  padding: 0.35rem 0.6rem;
  border-radius: 6px;
  background: var(--navy);
  color: #fff;
  font-size: 0.78rem;
  line-height: 1.3;
  opacity: 0;
  transform: translateY(4px);
  pointer-events: none;
  transition: opacity 0.15s ease, transform 0.15s ease;
}
.reason-hint:hover + .reason-tip,
.reason-hint:focus-visible + .reason-tip {
  opacity: 1;
  transform: none;
}
</style>
