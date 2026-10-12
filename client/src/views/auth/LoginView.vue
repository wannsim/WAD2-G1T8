<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'
import { API_URL } from '@/utils/config'
import { saveUser } from '@/utils/auth'
import '@/assets/auth.css'
 
// Owner: Wan Sim
const router = useRouter()
const email = ref('')
const password = ref('')
const error = ref('')
const rememberMe = ref(false)
const showPassword = ref(false)
const loading = ref(false)
const googleRole = ref('buyer') // only used when a brand-new user signs up with Google
 
async function login() {
  error.value = ''
  loading.value = true
  try {
    const response = await axios.post(`${API_URL}/users/login`, {
      email: email.value,
      password: password.value,
    })
    saveUser(response.data, rememberMe.value)
    router.push(response.data.role === 'seller' ? '/seller/shop' : '/home')
  } catch (err) {
    error.value = err.response?.data?.message || err.message
  } finally {
    loading.value = false
  }
}
 
async function handleGoogle(googleResponse) {
  error.value = ''
  try {
    const response = await axios.post(`${API_URL}/users/google`, {
      credential: googleResponse.credential,
      role: googleRole.value,
    })
    saveUser(response.data, rememberMe.value)
    router.push(response.data.role === 'seller' ? '/seller/shop' : '/home')
  } catch (err) {
    error.value = err.response?.data?.message || err.message
  }
}
 
function setupGoogle() {
  window.google.accounts.id.initialize({
    client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
    callback: handleGoogle,
  })
  const box = document.getElementById('google-btn')
  window.google.accounts.id.renderButton(box, {
    theme: 'outline',
    size: 'large',
    text: 'continue_with',
    shape: 'rectangular',
    width: Math.min(box.offsetWidth, 400), // Google only accepts a pixel width
  })
}
 
onMounted(() => {
  // if Google's script is already loaded (e.g. you came back to this page), just draw the button
  if (window.google && window.google.accounts) {
    setupGoogle()
    return
  }
  const script = document.createElement('script')
  script.src = 'https://accounts.google.com/gsi/client'
  script.onload = setupGoogle
  document.head.appendChild(script)
})
</script>
 
<template>
  <div class="auth-stage">
    <div class="auth-card">
      <h2 class="auth-title text-center">Welcome Back</h2>
      <p class="text-center text-muted mb-4">Please enter your details</p>
 
      <div v-if="error" class="alert alert-danger py-2 small">{{ error }}</div>
 
      <div class="auth-field">
        <label class="auth-label" for="email">Email</label>
        <input id="email" type="email" class="auth-input" v-model.trim="email" autocomplete="email" />
      </div>
 
      <div class="auth-field">
        <label class="auth-label" for="password">Password</label>
        <input
          id="password"
          :type="showPassword ? 'text' : 'password'"
          class="auth-input pe-5"
          v-model="password"
          autocomplete="current-password"
          @keyup.enter="login"
        />
        <button
          type="button"
          class="auth-eye"
          :aria-label="showPassword ? 'Hide password' : 'Show password'"
          @click="showPassword = !showPassword"
        >
          <!-- eye (password hidden) -->
          <svg v-if="!showPassword" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
          <!-- eye with a line through it (password visible) -->
          <svg v-else width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
            <line x1="1" y1="1" x2="23" y2="23" />
          </svg>
        </button>
      </div>
 
      <div class="d-flex justify-content-between align-items-center small mb-3">
        <div class="form-check mb-0">
          <input class="form-check-input" type="checkbox" id="remember" v-model="rememberMe" />
          <label class="form-check-label" for="remember">Remember me</label>
        </div>
      </div>
 
      <button class="btn btn-brand w-100 auth-btn" :disabled="loading" @click="login">
        {{ loading ? 'Logging in...' : 'Log In' }}
      </button>
 
      <div class="auth-divider">or</div>
 
      <div id="google-btn" class="auth-google"></div>
 
      <div class="mt-2 small text-muted text-center">
        New with Google? Join as a
        <select class="form-select form-select-sm d-inline-block w-auto" v-model="googleRole">
          <option value="buyer">buyer</option>
          <option value="seller">seller</option>
        </select>
      </div>
 
      <p class="mt-4 mb-0 text-center small">
        New here?
        <RouterLink to="/register" class="auth-link">Create an account.</RouterLink>
      </p>
    </div>
  </div>
</template>