<script setup>
import { useRouter } from 'vue-router'
import { currentUser, isLoggedIn, isSeller, clearUser } from '@/utils/auth'

const router = useRouter()

function logout() {
  clearUser()
  router.push('/login')
}
</script>

<template> 
  <nav class="navbar navbar-expand-lg bg-white border-bottom">
    <div class="container">
      <RouterLink class="navbar-brand" to="/home">Homly Hauls</RouterLink>
      <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#mainNav">
        <span class="navbar-toggler-icon"></span>
      </button>

      <div class="collapse navbar-collapse" id="mainNav">
        <ul class="navbar-nav me-auto">
          <li class="nav-item"><RouterLink class="nav-link" to="/home">For You</RouterLink></li>
          <li class="nav-item"><RouterLink class="nav-link" to="/browse">Browse</RouterLink></li>
          <li class="nav-item"><RouterLink class="nav-link" to="/map">Map</RouterLink></li>

          <!-- buyers -->
          <template v-if="isLoggedIn && !isSeller">
            <li class="nav-item"><RouterLink class="nav-link" to="/favourites">Favourites</RouterLink></li>
            <li class="nav-item"><RouterLink class="nav-link" to="/orders">My Orders</RouterLink></li>
          </template>

          <!-- sellers -->
          <template v-if="isSeller">
            <li class="nav-item"><RouterLink class="nav-link" to="/seller/shop">My Shop</RouterLink></li>
            <li class="nav-item"><RouterLink class="nav-link" to="/seller/products">My Products</RouterLink></li>
            <li class="nav-item"><RouterLink class="nav-link" to="/seller/orders">Shop Orders</RouterLink></li>
          </template>
        </ul>

        <ul class="navbar-nav">
          <template v-if="isLoggedIn">
            <li class="nav-item"><RouterLink class="nav-link" to="/profile">{{ currentUser.name }}</RouterLink></li>
            <li class="nav-item"><a class="nav-link" href="#" @click="logout">Log out</a></li>
          </template>
          <template v-else>
            <li class="nav-item"><RouterLink class="nav-link" to="/login">Log in</RouterLink></li>
            <li class="nav-item"><RouterLink class="nav-link" to="/register">Sign up</RouterLink></li>
          </template>
        </ul>
      </div>
    </div>
  </nav>
</template>
