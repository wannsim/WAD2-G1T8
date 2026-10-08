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
</script>

<template>
  <div class="card h-100 shadow-sm">
    <img :src="product.imageUrl || '/placeholder.svg'" class="card-img-top product-img" :alt="product.name" />
    <div class="card-body d-flex flex-column">
      <h5 class="card-title">{{ product.name }}</h5>
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

      <div class="mt-auto d-flex justify-content-between align-items-center">
        <RouterLink :to="`/products/${product._id}`" class="btn btn-sm btn-brand">View</RouterLink>
        <slot></slot>
      </div>
    </div>
  </div>
</template>
