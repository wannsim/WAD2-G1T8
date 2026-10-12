<script setup>
import { useRouter } from 'vue-router'
import { currentUser, isLoggedIn, isSeller, clearUser } from '@/utils/auth'
 
// Owner: Wan Sim
const router = useRouter()
 
function logout() {
  clearUser()
  router.push('/login')
}
</script>
 
<template>
  <header class="container pt-3">
    <nav class="navbar navbar-expand-lg nav-card">
      <!-- logo + name -->
      <RouterLink class="navbar-brand d-flex align-items-center gap-2 me-lg-4" to="/home">
        <svg width="34" height="34" viewBox="0 0 34 34" aria-hidden="true">
          <rect width="34" height="34" rx="9" fill="#c2410c" />
          <path d="M8 16 17 8l9 8v10H8z" fill="#fff" />
          <rect x="14" y="19" width="6" height="7" fill="#c2410c" />
        </svg>
        <span>Homly Hauls</span>
      </RouterLink>
 
      <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#mainNav">
        <span class="navbar-toggler-icon"></span>
      </button>
 
      <div class="collapse navbar-collapse" id="mainNav">
        <!-- tabs: the page you are on gets a tinted pill (router-link-active) -->
        <ul class="navbar-nav me-auto gap-lg-1">
          <li class="nav-item"><RouterLink class="nav-link nav-pill" to="/home">For You</RouterLink></li>
          <li class="nav-item"><RouterLink class="nav-link nav-pill" to="/browse">Browse</RouterLink></li>
          <li class="nav-item"><RouterLink class="nav-link nav-pill" to="/map">Map</RouterLink></li>
 
          <!-- buyers -->
          <template v-if="isLoggedIn && !isSeller">
            <li class="nav-item"><RouterLink class="nav-link nav-pill" to="/favourites">Favourites</RouterLink></li>
            <li class="nav-item"><RouterLink class="nav-link nav-pill" to="/orders">My Orders</RouterLink></li>
          </template>
 
          <!-- sellers -->
          <template v-if="isSeller">
            <li class="nav-item"><RouterLink class="nav-link nav-pill" to="/seller/shop">My Shop</RouterLink></li>
            <li class="nav-item"><RouterLink class="nav-link nav-pill" to="/seller/products">My Products</RouterLink></li>
            <li class="nav-item"><RouterLink class="nav-link nav-pill" to="/seller/orders">Shop Orders</RouterLink></li>
          </template>
        </ul>
 
        <!-- right side: Login button, or the user's name with a small menu -->
        <div class="mt-2 mt-lg-0">
          <RouterLink v-if="!isLoggedIn" to="/login" class="btn nav-login">Login</RouterLink>
 
          <div v-else class="dropdown">
            <button class="btn nav-login dropdown-toggle" type="button" data-bs-toggle="dropdown">
              {{ currentUser.name }}
            </button>
            <ul class="dropdown-menu dropdown-menu-end">
              <li><RouterLink class="dropdown-item" to="/profile">Profile</RouterLink></li>
              <li><hr class="dropdown-divider" /></li>
              <li><button class="dropdown-item" type="button" @click="logout">Log out</button></li>
            </ul>
          </div>
        </div>
      </div>
    </nav>
  </header>
</template>
 
<style scoped>
/* the white floating bar */
.nav-card {
  padding: 0.6rem 1rem;
  border-radius: 1rem;
  background: #fff;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
}
 
/* tab pills */
.nav-pill {
  padding: 0.5rem 1rem !important;
  border-radius: 0.75rem;
  font-weight: 500;
  color: #2b2b2b;
}
.nav-pill:hover {
  background: #f3f0ea;
}
/* active tab: tinted background + brand-coloured text (same idea as the blue "Home" pill) */
.nav-pill.router-link-active {
  background: rgba(194, 65, 12, 0.1);
  color: var(--brand);
}
 
/* outlined Login / user button */
.nav-login {
  padding: 0.45rem 1.1rem;
  border: 1px solid #cfc8bc;
  border-radius: 0.6rem;
  background: #fff;
  font-weight: 500;
  color: #2b2b2b;
}
.nav-login:hover,
.nav-login:focus {
  border-color: var(--brand);
  color: var(--brand);
  background: #fff;
}
</style>