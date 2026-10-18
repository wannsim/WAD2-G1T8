<script setup>
import { currentUser } from '@/utils/auth'
import BuyerProfileView from './BuyerProfileView.vue'
import SellerProfileView from './SellerProfileView.vue'
 
// Save as: client/src/views/auth/ProfileView.vue
// /profile shows a different page depending on who is logged in:
//   seller -> SellerProfileView (shop setup, certificates...)
//   buyer  -> BuyerProfileView  (name, interests)
//   (logged out users also land on BuyerProfileView, which sends them to the login page)
</script>
 
<template>
  <SellerProfileView v-if="currentUser && currentUser.role === 'seller'" />
  <BuyerProfileView v-else />
</template>