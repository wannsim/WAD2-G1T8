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

function setSaved(productId, saved) {
  const has = savedIds.value.includes(productId)
  if (saved && !has) savedIds.value = [...savedIds.value, productId]
  if (!saved && has) savedIds.value = savedIds.value.filter((id) => id !== productId)
}

// Saves the product, or un-saves it if already saved.
// The ♥ changes STRAIGHT AWAY (no waiting for the server). Requests for the same product are sent one
// after another, each saying the state wanted, so fast clicking always ends on the last click.
// If the server fails, the ♥ goes back to how it was.
const lastWanted = new Map() // productId -> state of the latest click
const queue = new Map()      // productId -> the request that is still running
export function toggleSaved(productId) {
  const saved = !savedIds.value.includes(productId)
  lastWanted.set(productId, saved)
  setSaved(productId, saved)

  const send = () => axios.post(`${API_URL}/favourites`, { user: currentUser.value._id, product: productId, saved })
  const request = (queue.get(productId) || Promise.resolve())
    .then(send)
    .then((response) => {
      if (lastWanted.get(productId) === saved) setSaved(productId, response.data.saved)
    })
    .catch((err) => {
      if (lastWanted.get(productId) === saved) setSaved(productId, !saved) // undo
      throw err
    })
  queue.set(productId, request.catch(() => {}))
  return request
}
