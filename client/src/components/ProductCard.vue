<script setup>
import { computed } from 'vue'
import { formatPrice } from '@/utils/format'

// Shared card used by Browse, FYP, Favourites, Shop pages.
//   <ProductCard :product="p" />
//   <ProductCard :product="p" :reason="'Matches your interests'">   <- optional "Why recommended?"
//       <button>extra buttons go in the slot</button>
//   </ProductCard>
const props = defineProps({
  product: Object,
  reason: String,
})

// product.shop is an object when the server populated it, otherwise just an id
const shopName = computed(() => props.product.shop?.name || '')

// no photo / broken link -> show the placeholder instead of an empty box
function useFallbackImage(event) {
  if (!event.target.src.endsWith('/placeholder.svg')) event.target.src = '/placeholder.svg'
}
</script>

<template>
  <!-- <div class="card h-100 shadow-sm"> -->
  <div class="product-card card h-100 shadow-sm">
    <div class="card-summary">
      <!-- lazy: only download pictures that are on (or near) the screen -->
      <img :src="product.imageUrl || '/placeholder.svg'" class="card-img-top product-img" :alt="product.name"
        loading="lazy" decoding="async" @error="useFallbackImage" />
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
  transition: opacity 0.2s ease;
}

.product-img {
  height: 180px;
  object-fit: cover;
}

.card-preview {
  position: absolute;
  inset: 0;
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

.product-card:hover .card-preview,
.product-card:focus-within .card-preview {
  opacity: 1;
  visibility: visible;
  transform: translateY(0);
}

.product-card:hover .card-summary {
  opacity: 0;
}
</style>