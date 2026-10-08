<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'
import { API_URL } from '@/utils/config'
import { saveUser } from '@/utils/auth'

// Owner: Wan Sim
const router = useRouter()
const email = ref('')
const password = ref('')
const error = ref('')

async function login() {
  error.value = ''
  try {
    const response = await axios.post(`${API_URL}/users/login`, {
      email: email.value,
      password: password.value,
    })
    saveUser(response.data)
    router.push(response.data.role === 'seller' ? '/seller/shop' : '/home')
  } catch (err) {
    error.value = err.response?.data?.message || err.message
  }
}
</script>

<template>
  <div class="row justify-content-center">
    <div class="col-md-5">
      <h2 class="mb-3">Log in</h2>
      <div v-if="error" class="alert alert-danger">{{ error }}</div>

      <div class="mb-3">
        <label class="form-label">Email</label>
        <input type="email" class="form-control" v-model.trim="email" />
      </div>
      <div class="mb-3">
        <label class="form-label">Password</label>
        <input type="password" class="form-control" v-model="password" @keyup.enter="login" />
      </div>
      <button class="btn btn-brand w-100" @click="login">Log in</button>

      <p class="mt-3">No account yet? <RouterLink to="/register">Sign up</RouterLink></p>
    </div>
  </div>
</template>
