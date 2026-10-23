export function formatPrice(n) {
  return '$' + Number(n || 0).toFixed(2)
}

export function formatDateTime(d) {
  if (!d) return ''
  return new Date(d).toLocaleString('en-SG', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Singapore',
  })
}
// short date + time for notifications, e.g. "21 Oct, 3:30 pm" (adds the year if it is not this year)
export function formatShortDateTime(d) {
  if (!d) return ''
  const date = new Date(d)
  const thisYear = date.getFullYear() === new Date().getFullYear()
  return date.toLocaleString('en-SG', {
    day: 'numeric',
    month: 'short',
    year: thisYear ? undefined : 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Asia/Singapore',
  })
}

// first letter in capitals, for values saved in lowercase, e.g. "accepted" -> "Accepted", "pickup" -> "Pickup"
export function capitalize(text) {
  const s = String(text ?? '')
  return s.charAt(0).toUpperCase() + s.slice(1)
}

// "3 days ago", "5 months ago", "2 years ago"
export function timeAgo(d) {
  if (!d) return ''
  const days = Math.floor((Date.now() - new Date(d).getTime()) / 86400000)
  const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'} ago`
  if (days < 1) return 'Today'
  if (days < 30) return plural(days, 'day')
  if (days < 365) return plural(Math.floor(days / 30), 'month')
  return plural(Math.floor(days / 365), 'year')
}

// 1234 -> "1.2k" (follower / rating counts)
export function shortNumber(n) {
  const value = Number(n || 0)
  return value >= 1000 ? `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}k` : String(value)
}
