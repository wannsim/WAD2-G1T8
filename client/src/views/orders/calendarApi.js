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

// Requests consent after the server checks Homly ownership; returns only a URL or message.
export async function startCalendarConnect(userId, password, returnTo) {
  try {
    const response = await axios.post(`${API_URL}/calendar/connect-start`, { userId, password, returnTo })
    if (response.data && response.data.url) return { url: response.data.url }
    return { error: 'Could not connect Google Calendar. Please try again.' }
  } catch (err) {
    if (err.response && err.response.data && err.response.data.message) return { error: err.response.data.message }
    return { error: 'Could not connect Google Calendar. Please try again.' }
  }
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
