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
