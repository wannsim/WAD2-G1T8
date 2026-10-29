import { ref, watch } from 'vue'
import axios from 'axios'
import { API_URL } from './config'
import { currentUser, isSeller } from './auth'

// Owner: Cheyenne
// Small shared state for the app frame (sidebar in NavBar.vue + top bar in TopBar.vue).

// phones / tablets: is the sidebar drawer open?
export const navOpen = ref(false)

// wide screens: is the sidebar collapsed to icons only? Collapsed by default (it opens while hovered);
// clicking the expand button keeps it open. The choice is remembered in this browser.
const readCollapsed = () => {
  try {
    return localStorage.getItem('navCollapsed') !== '0'
  } catch {
    return true
  }
}
export const navCollapsed = ref(readCollapsed())
watch(navCollapsed, (collapsed) => {
  try {
    localStorage.setItem('navCollapsed', collapsed ? '1' : '0')
  } catch {
    // storage blocked: just don't remember it
  }
})

// sellers: their shop's profile photo (shown as the avatar in the top bar). '' = none -> first letter of the name.
// ShopHeader updates it straight away when the seller uploads / removes the photo.
export const myShopAvatar = ref('')
export const shopAvatarUrl = (shopId, updatedAt) =>
  updatedAt ? `${API_URL}/shops/${shopId}/avatar?v=${new Date(updatedAt).getTime()}` : ''
// a user's own profile picture (buyers); '' if they have none
export const userAvatarUrl = (user) =>
  user?.avatarUpdatedAt ? `${API_URL}/users/${user._id}/avatar?v=${new Date(user.avatarUpdatedAt).getTime()}` : ''
// chat: { kind: 'shop' | 'user', id, updatedAt } (from /chats) -> the picture's URL, or ''
export const chatAvatarUrl = (avatar) =>
  !avatar?.updatedAt ? '' : avatar.kind === 'shop' ? shopAvatarUrl(avatar.id, avatar.updatedAt) : userAvatarUrl({ _id: avatar.id, avatarUpdatedAt: avatar.updatedAt })

// the user's latest orders (buyers: what they ordered, sellers: what their shop received)
// used by the sidebar ("Last orders") and the top bar ("N orders, last 7 days")
export const recentOrders = ref([])

export async function loadRecentOrders() {
  const user = currentUser.value
  if (!user) {
    recentOrders.value = []
    myShopAvatar.value = ''
    return
  }
  try {
    let url = `${API_URL}/orders/buyer/${user._id}`
    if (isSeller.value) {
      const shop = await axios.get(`${API_URL}/shops/mine/${user._id}`)
      myShopAvatar.value = shopAvatarUrl(shop.data?._id, shop.data?.avatarUpdatedAt)
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

// shops the buyer follows (top bar "Following" stack). FollowButton reloads it after a follow / unfollow.
export const followedShops = ref([])

export async function loadFollowedShops() {
  if (!currentUser.value || isSeller.value) {
    followedShops.value = []
    return
  }
  try {
    const response = await axios.get(`${API_URL}/shops/following/${currentUser.value._id}`)
    followedShops.value = response.data
  } catch (err) {
    followedShops.value = []
  }
}
