import axios from 'axios'
import { currentUser, clearUser } from './auth'

// Every request to our server carries the login token, so the server knows who is asking
// (server/utils/auth.js). Set up once in main.js; pages keep using axios as normal.
export function setupHttp(router) {
  axios.interceptors.request.use((config) => {
    const token = currentUser.value?.token
    if (token) config.headers.Authorization = `Bearer ${token}`
    return config
  })

  // 401 = the token is missing, changed or expired (7 days) -> log out and go to the login page
  axios.interceptors.response.use(
    (response) => response,
    (error) => {
      const sentToken = !!error.config?.headers?.Authorization
      if (error.response?.status === 401 && sentToken && currentUser.value) {
        clearUser()
        router.push({ path: '/login', query: { expired: '1' } })
      }
      return Promise.reject(error)
    }
  )
}
