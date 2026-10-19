import { ref } from 'vue'
import axios from 'axios'
import { API_URL } from './config'
import { currentUser } from './auth'

// The logged-in user's saved product ids, shared by every ♥ button,
// so a page full of cards only asks the server once.
export const savedIds = ref([])
let loadedFor = null // which user savedIds belongs to

export async function loadSavedIds() {
  const userId = currentUser.value?._id
  if (!userId || loadedFor === userId) return
  loadedFor = userId
  try {
    const response = await axios.get(`${API_URL}/favourites/${userId}/ids`)
    savedIds.value = response.data
  } catch (err) {
    loadedFor = null // try again next time
    console.log(err.message)
  }
}

// saves the product, or un-saves it if already saved
export async function toggleSaved(productId) {
  const response = await axios.post(`${API_URL}/favourites`, { user: currentUser.value._id, product: productId })
  if (response.data.saved) savedIds.value.push(productId)
  else savedIds.value = savedIds.value.filter((id) => id !== productId)
}
