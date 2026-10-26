import { ref, watch } from 'vue'
import axios from 'axios'
import { API_URL } from './config'
import { currentUser, isSeller } from './auth'

// Owner: Cheyenne
// Small shared state for the app frame (sidebar in NavBar.vue + top bar in TopBar.vue).

// phones / tablets: is the sidebar drawer open?
export const navOpen = ref(false)

// the user's latest orders (buyers: what they ordered, sellers: what their shop received)
// used by the sidebar ("Last orders") and the top bar ("N orders, last 7 days")
export const recentOrders = ref([])

export async function loadRecentOrders() {
  const user = currentUser.value
  if (!user) {
    recentOrders.value = []
    return
  }
  try {
    let url = `${API_URL}/orders/buyer/${user._id}`
    if (isSeller.value) {
      const shop = await axios.get(`${API_URL}/shops/mine/${user._id}`)
      if (!shop.data?._id) {
        recentOrders.value = []
        return
      }
      url = `${API_URL}/orders/shop/${shop.data._id}`
    }
    const response = await axios.get(url)
    recentOrders.value = [...response.data].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
  } catch (err) {
    recentOrders.value = [] // no shop yet / server off
  }
}

watch(currentUser, loadRecentOrders)
