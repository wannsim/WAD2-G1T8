<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'
import { API_URL } from '@/utils/config'
import { saveUser } from '@/utils/auth'

// Owner: Wan Sim
const router = useRouter()
const email = ref('')
const password = ref('')
const error = ref('')
const rememberMe = ref(false)

async function login() {
  error.value = ''
  try {
    const response = await axios.post(`${API_URL}/users/login`, {
      email: email.value,
      password: password.value,
    })
    // saveUser(response.data)
    saveUser(response.data, rememberMe.value)
    router.push(response.data.role === 'seller' ? '/seller/shop' : '/home')
  } catch (err) {
    error.value = err.response?.data?.message || err.message
  }
}

const googleRole = ref('buyer') // only used when a brand-new user signs up with Google

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

onMounted(() => {
  // load Google's script, then draw the button
  const script = document.createElement('script')
  script.src = 'https://accounts.google.com/gsi/client'
  script.onload = () => {
    window.google.accounts.id.initialize({
      client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
      callback: handleGoogle,
    })
    window.google.accounts.id.renderButton(document.getElementById('google-btn'), {
      theme: 'outline',
      size: 'large',
    })
  }
  document.head.appendChild(script)
})
// saveUser(response.data, rememberMe.value)

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
      <div class="form-check mb-3">
      <input class="form-check-input" type="checkbox" id="remember" v-model="rememberMe" />
      <label class="form-check-label" for="remember">Remember me</label>
    </div>
      <button class="btn btn-brand w-100" @click="login">Log in</button>

      <div class="text-center text-muted my-3">or</div>
      <div id="google-btn" class="d-flex justify-content-center"></div>

      <div class="mt-2 small text-muted text-center">
        New here? Sign up with Google as a
        <select class="form-select form-select-sm d-inline-block w-auto" v-model="googleRole">
          <option value="buyer">buyer</option>
          <option value="seller">seller</option>
        </select>
      </div>

      <p class="mt-3">No account yet? <RouterLink to="/register">Sign up</RouterLink></p>
    </div>
  </div>
</template>
