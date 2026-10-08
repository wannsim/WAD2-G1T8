import { ref, computed } from 'vue'

// Who is logged in? Stored in localStorage so it survives a page refresh (Week 6).
// Only NON-sensitive info is stored: { _id, name, email, role, preferences }. Never the password.
//
// Because currentUser is a ref created in this file, every component that imports it
// sees the same value and updates automatically (e.g. NavBar changes when you log in).
const KEY = 'homebiz_user'

export const currentUser = ref(JSON.parse(localStorage.getItem(KEY)))
export const isLoggedIn = computed(() => currentUser.value !== null)
export const isSeller = computed(() => currentUser.value?.role === 'seller')

export function saveUser(user) {
  currentUser.value = user
  localStorage.setItem(KEY, JSON.stringify(user))
}

export function clearUser() {
  currentUser.value = null
  localStorage.removeItem(KEY)
}
