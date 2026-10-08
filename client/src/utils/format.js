export function formatPrice(n) {
  return '$' + Number(n || 0).toFixed(2)
}

export function formatDateTime(d) {
  if (!d) return ''
  return new Date(d).toLocaleString('en-SG', { dateStyle: 'medium', timeStyle: 'short' })
}
