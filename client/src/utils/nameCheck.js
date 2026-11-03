import { ref, watch } from 'vue'
import axios from 'axios'
import { API_URL } from '@/utils/config'

// Live "is this name free?" check while the user types (Register + Profile).
//   const { nameStatus, nameMessage } = useNameCheck(name, { exceptId: () => myId, unchanged: () => savedName })
// nameStatus: ''  (nothing to show) | 'checking' | 'available' | 'taken'
// The server checks again when saving, so this is only a friendly early warning.
export function useNameCheck(nameRef, { exceptId = () => '', unchanged = () => '' } = {}) {
  const nameStatus = ref('')
  const nameMessage = ref('')
  let timer = null

  watch(nameRef, (value) => {
    clearTimeout(timer)
    const name = String(value || '').trim().replace(/\s+/g, ' ')
    nameMessage.value = ''
    // empty, or the user's own current name -> nothing to show
    if (!name || name === unchanged()) {
      nameStatus.value = ''
      return
    }
    nameStatus.value = 'checking'
    timer = setTimeout(async () => {
      try {
        const { data } = await axios.get(`${API_URL}/users/name-available`, {
          params: { name, except: exceptId() || undefined },
        })
        if (String(nameRef.value || '').trim().replace(/\s+/g, ' ') !== name) return // they kept typing
        nameStatus.value = data.available ? 'available' : 'taken'
        // other problems (e.g. too long) show the server's own words
        nameMessage.value = data.available ? 'Username available'
          : data.message.includes('already taken') ? 'Username is taken' : data.message
      } catch {
        nameStatus.value = '' // can't check right now - the server still checks on save
      }
    }, 400)
  })

  return { nameStatus, nameMessage }
}
