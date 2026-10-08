<script setup>
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import axios from 'axios'
import { API_URL } from '@/utils/config'
import ReviewList from '@/components/ReviewList.vue' // Yu Chen's component

// Owner: Member 3 - /shops/:id
const route = useRoute()
const shop = ref(null)
const products = ref([])

onMounted(async () => {
  try {
    const shopResponse = await axios.get(`${API_URL}/shops/${route.params.id}`)
    shop.value = shopResponse.data
    const productResponse = await axios.get(`${API_URL}/products`, { params: { shop: route.params.id } })
    products.value = productResponse.data
  } catch (error) {
    console.log(error.message)
  }
})
</script>

<template>
  <div v-if="shop">
    <h2>{{ shop.name }}</h2>
    <p class="text-muted">{{ shop.nearestMrt }} MRT</p>
    <p>{{ shop.description }}</p>

    <div class="mb-3">
      <span v-if="shop.pickup" class="badge bg-success me-1">Pickup</span>
      <span v-if="shop.delivery" class="badge bg-primary me-1">Delivery</span>
    </div>

    <!-- trust info (numbers come from Yu Chen's trust-score module) -->
    <div class="card card-body mb-4">
      <div>
        <StarRating :value="shop.stats.avgRating" />
        {{ shop.stats.avgRating }} ({{ shop.stats.reviewCount }} reviews)
      </div>
      <div class="small text-muted">
        Trust score {{ shop.stats.trustScore }}/100 &middot;
        Fulfilment {{ Math.round(shop.stats.fulfilmentRate * 100) }}% &middot;
        Cancellation {{ Math.round(shop.stats.cancellationRate * 100) }}% &middot;
        Replies in about {{ shop.stats.avgResponseMins }} min
      </div>
    </div>

    <h4 class="mb-3">Products</h4>
    <div class="row g-3 mb-5">
      <div v-for="p in products" :key="p._id" class="col-sm-6 col-lg-3">
        <ProductCard :product="p" />
      </div>
    </div>

    <ReviewList :shop-id="shop._id" />
  </div>
</template>
