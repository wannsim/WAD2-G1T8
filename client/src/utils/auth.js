
import { ref, computed } from 'vue'
import { joinRoom, leaveRoom } from './socket' // for live chat
 
// Save as: client/src/utils/auth.js
const KEY = 'homly_hauls_user'
 
// look in both places: remembered logins live in localStorage, session-only logins in sessionStorage
function loadUser() {
  const saved = localStorage.getItem(KEY) || sessionStorage.getItem(KEY)
  return saved ? JSON.parse(saved) : null
}
 
// a login saved before tokens existed can't prove who it is -> treat it as logged out (log in again once)
const saved = loadUser()
if (saved && !saved.token) {
  localStorage.removeItem(KEY)
  sessionStorage.removeItem(KEY)
}
export const currentUser = ref(saved?.token ? saved : null)
export const isLoggedIn = computed(() => currentUser.value !== null)
export const isSeller = computed(() => currentUser.value?.role === 'seller')
 
if (currentUser.value) joinRoom(currentUser.value.token) // already logged in when the page loads
 
// remember = true  -> localStorage (stays after closing the browser)
// remember = false -> sessionStorage (gone when the tab/browser closes)
// remember not given (e.g. profile update) -> keep it wherever it already was
// user.token comes from login; a profile update has none, so the current token is kept
export function saveUser(newUser, remember) {
  const useSession = remember === undefined ? sessionStorage.getItem(KEY) !== null : !remember
  const user = { ...newUser, token: newUser.token || currentUser.value?.token }
 
  currentUser.value = user
  localStorage.removeItem(KEY)
  sessionStorage.removeItem(KEY)
 
  const storage = useSession ? sessionStorage : localStorage
  storage.setItem(KEY, JSON.stringify(user))
  joinRoom(user.token)
}
 
export function clearUser() {
  leaveRoom()
  currentUser.value = null
  localStorage.removeItem(KEY)
  sessionStorage.removeItem(KEY)
}
 