<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'
import { API_URL } from '@/utils/config'
import { currentUser } from '@/utils/auth'
import { formatPrice } from '@/utils/format'

// Owner: Cheyenne - list, edit, delete the seller's products
const router = useRouter()
const products = ref([])

async function loadProducts() {
  try {
    const shopResponse = await axios.get(`${API_URL}/shops/mine/${currentUser.value._id}`)
    if (!shopResponse.data) {
      router.push('/seller/shop') // create a shop first
      return
    }
    const response = await axios.get(`${API_URL}/products`, { params: { shop: shopResponse.data._id } })
    products.value = response.data
  } catch (error) {
    console.log(error.message)
  }
}

async function deleteProduct(id) {
  try {
    await axios.delete(`${API_URL}/products/${id}`)
    products.value = products.value.filter((p) => p._id !== id)
  } catch (error) {
    console.log(error.message)
  }
}

onMounted(() => {
  if (!currentUser.value || currentUser.value.role !== 'seller') {
    router.push('/login')
    return
  }
  loadProducts()
})
</script>

<template>
  <div>
    <div class="d-flex justify-content-between align-items-center mb-3">
      <h2>My products</h2>
      <RouterLink to="/seller/products/new" class="btn btn-brand">+ Add product</RouterLink>
    </div>

    <p v-if="products.length === 0" class="text-muted">You have not listed any products yet.</p>

    <table v-else class="table align-middle bg-white">
      <thead>
        <tr><th>Name</th><th>Category</th><th>Price</th><th>Available</th><th></th></tr>
      </thead>
      <tbody>
        <tr v-for="p in products" :key="p._id">
          <td>{{ p.name }}</td>
          <td>{{ p.category }}</td>
          <td>{{ formatPrice(p.price) }} / {{ p.unit }}</td>
          <td>{{ p.isAvailable ? 'Yes' : 'No' }}</td>
          <td class="text-end">
            <RouterLink :to="`/seller/products/${p._id}/edit`" class="btn btn-sm btn-outline-secondary me-2">Edit</RouterLink>
            <button class="btn btn-sm btn-outline-danger" @click="deleteProduct(p._id)">Delete</button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
