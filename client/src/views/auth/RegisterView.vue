<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'
import { API_URL } from '@/utils/config'
import '@/assets/auth.css'
 
// Owner: Wan Sim
const router = useRouter()
const name = ref('')
const email = ref('')
const password = ref('')
const role = ref('buyer')
const error = ref('')
const showPassword = ref(false)
const loading = ref(false)
 
async function register() {
  error.value = ''
  loading.value = true
  try {
    await axios.post(`${API_URL}/users/register`, {
      name: name.value,
      email: email.value,
      password: password.value,
      role: role.value,
    })
    router.push('/login')
  } catch (err) {
    error.value = err.response?.data?.message || err.message
  } finally {
    loading.value = false
  }
}
</script>
 
<template>
  <div class="auth-stage">
    <div class="auth-card">
      <h2 class="auth-title text-center">Create an Account</h2>
      <p class="text-center text-muted mb-4">Please enter your details</p>
 
      <div v-if="error" class="alert alert-danger py-2 small">{{ error }}</div>
 
      <div class="auth-field">
        <label class="auth-label" for="name">Name</label>
        <input id="name" type="text" class="auth-input" v-model.trim="name" autocomplete="name" />
      </div>
 
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
          autocomplete="new-password"
          @keyup.enter="register"
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
 
      <div class="auth-field">
        <label class="auth-label" for="role">I want to...</label>
        <select id="role" class="auth-input" v-model="role">
          <option value="buyer">Buy from home businesses</option>
          <option value="seller">Sell my products</option>
        </select>
      </div>
 
      <button class="btn btn-brand w-100 auth-btn" :disabled="loading" @click="register">
        {{ loading ? 'Creating account...' : 'Sign Up' }}
      </button>
 
      <p class="mt-4 mb-0 text-center small">
        Already have an account?
        <RouterLink to="/login" class="auth-link">Log in.</RouterLink>
      </p>
    </div>
  </div>
</template>
 