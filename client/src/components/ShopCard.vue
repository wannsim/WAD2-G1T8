<script setup>
import { computed } from 'vue'
import FollowButton from './FollowButton.vue';

// Shared card used by Browse, FYP, Favourites, Shop pages.
//   <ProductCard :product="p" />
//   <ProductCard :product="p" :reason="'Matches your interests'">   <- optional "Why recommended?"
//       <button>extra buttons go in the slot</button>
//   </ProductCard>
const props = defineProps({
    shop: Object,
})

// product.shop is an object when the server populated it, otherwise just an id
const shopName = computed(() => props.shop.name)
const reviewCount = computed(() => props.shop.stats.reviewCount)
</script>

<template>
    <div class="card h-100 shadow-sm" style="width: 400px;">
        <!-- <img :src="shop.imageUrl || '/placeholder.svg'" class="card-img-top product-img" :alt="shop.name" /> -->
        <div class="card-body d-flex flex-column">
            <div class="d-flex justify-content-between align-items-start flex-wrap gap-2">
                <RouterLink :to="`/shops/${shop._id}`" class="card-title fw-bold">
                    <h5 class="mb-1 mt-1">{{ shopName }}</h5>
                </RouterLink>
                <FollowButton class="btn-sm" :shop="shop" :followerCountTF="false" />
            </div>
            <div class="small">
                <!-- star rating -->
                <StarRating :value="shop.stats.avgRating" /> &nbsp;
                <span v-if="reviewCount == 1">({{ reviewCount }} review)</span>
                <span v-else>({{ reviewCount }} reviews)</span>
                <!-- description -->
                <div>
                    <span v-if="shop.description">{{ shop.description }}</span>
                </div>
            </div>
            
        </div>
    </div>
</template>
