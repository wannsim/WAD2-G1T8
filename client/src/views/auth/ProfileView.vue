<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'
import { API_URL } from '@/utils/config'
import { currentUser, saveUser } from '@/utils/auth'
import { CATEGORIES } from '@/utils/constants'

// Owner: Wan Sim
const router = useRouter()
const name = ref('')
const email = ref('')
const preferences = ref([])
const message = ref('')

onMounted(async () => {
  if (!currentUser.value) {
    router.push('/login') // access control: must be logged in
    return
  }
  try {
    const response = await axios.get(`${API_URL}/users/${currentUser.value._id}`)
    name.value = response.data.name
    email.value = response.data.email
    preferences.value = response.data.preferences
  } catch (error) {
    message.value = error.message
  }
})

async function save() {
  try {
    const response = await axios.put(`${API_URL}/users/${currentUser.value._id}`, {
      name: name.value,
      preferences: preferences.value,
    })
    saveUser(response.data) // keep localStorage + NavBar in sync
    message.value = 'Profile saved!'
  } catch (error) {
    message.value = error.message
  }
}
</script>

<template>
  <div class="row justify-content-center">
    <div class="col-md-6">
      <h2 class="mb-3">My profile</h2>
      <div v-if="message" class="alert alert-info">{{ message }}</div>

      <div class="mb-3">
        <label class="form-label">Email</label>
        <input type="email" class="form-control" :value="email" disabled />
      </div>
      <div class="mb-3">
        <label class="form-label">Name</label>
        <input type="text" class="form-control" v-model.trim="name" />
      </div>

      <!-- only buyers have preferences (they feed the For You page) -->
      <div v-if="currentUser && currentUser.role === 'buyer'" class="mb-3">
        <label class="form-label">What are you interested in?</label>
        <div v-for="category in CATEGORIES" :key="category" class="form-check">
          <input class="form-check-input" type="checkbox" :id="category" :value="category" v-model="preferences" />
          <label class="form-check-label" :for="category">{{ category }}</label>
        </div>
      </div>

      <button class="btn btn-brand" @click="save">Save</button>
    </div>
  </div>
</template>
