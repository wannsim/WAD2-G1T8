import axios from 'axios'
import { API_URL } from '@/utils/config'

// Loads safe Calendar connection information, hiding the feature on failure.
export async function calendarStatus(userId) {
  try {
    const response = await axios.get(`${API_URL}/calendar/status/${userId}`)
    return response.data
  } catch (err) {
    return { enabled: false, connected: false }
  }
}

// Builds a plain link so the server can redirect the user to Google.
export function connectLink(userId, returnTo) {
  return `${API_URL}/calendar/connect/${userId}?returnTo=${encodeURIComponent(returnTo)}`
}

// Disconnects Calendar, returning null when the request fails.
export async function disconnectCalendar(userId) {
  try {
    const response = await axios.post(`${API_URL}/calendar/disconnect`, { userId })
    return response.data
  } catch (err) {
    return null
  }
}

// Loads events within the given dates, returning an empty list on failure.
export async function calendarEvents(userId, from, to) {
  try {
    const response = await axios.get(`${API_URL}/calendar/events/${userId}`, {
      params: { from: new Date(from).toISOString(), to: new Date(to).toISOString() },
    })
    return response.data
  } catch (err) {
    return []
  }
}
