import { ref, computed } from 'vue'

const KEY = 'homly_hauls_user'

// look in both places: remembered logins live in localStorage, session-only logins in sessionStorage
function loadUser() {
  const saved = localStorage.getItem(KEY) || sessionStorage.getItem(KEY)
  return saved ? JSON.parse(saved) : null
}

export const currentUser = ref(loadUser())
export const isLoggedIn = computed(() => currentUser.value !== null)
export const isSeller = computed(() => currentUser.value?.role === 'seller')

// remember = true  -> localStorage (stays after closing the browser)
// remember = false -> sessionStorage (gone when the tab/browser closes)
// remember not given (e.g. profile update) -> keep it wherever it already was
export function saveUser(user, remember) {
  const useSession = remember === undefined ? sessionStorage.getItem(KEY) !== null : !remember

  currentUser.value = user
  localStorage.removeItem(KEY)
  sessionStorage.removeItem(KEY)

  const storage = useSession ? sessionStorage : localStorage
  storage.setItem(KEY, JSON.stringify(user))
}

export function clearUser() {
  currentUser.value = null
  localStorage.removeItem(KEY)
  sessionStorage.removeItem(KEY)
}