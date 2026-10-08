<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'
import { API_URL } from '@/utils/config'

// Owner: Wan Sim
const router = useRouter()
const name = ref('')
const email = ref('')
const password = ref('')
const role = ref('buyer')
const error = ref('')

async function register() {
  error.value = ''
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
  }
}
</script>

<template>
  <div class="row justify-content-center">
    <div class="col-md-5">
      <h2 class="mb-3">Create an account</h2>
      <div v-if="error" class="alert alert-danger">{{ error }}</div>

      <div class="mb-3">
        <label class="form-label">Name</label>
        <input type="text" class="form-control" v-model.trim="name" />
      </div>
      <div class="mb-3">
        <label class="form-label">Email</label>
        <input type="email" class="form-control" v-model.trim="email" />
      </div>
      <div class="mb-3">
        <label class="form-label">Password</label>
        <input type="password" class="form-control" v-model="password" />
      </div>
      <div class="mb-3">
        <label class="form-label">I want to...</label>
        <select class="form-select" v-model="role">
          <option value="buyer">Buy from home businesses</option>
          <option value="seller">Sell my products</option>
        </select>
      </div>
      <button class="btn btn-brand w-100" @click="register">Sign up</button>
    </div>
  </div>
</template>
