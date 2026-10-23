// Same as client/src/utils/format.js - e.g. "21 Oct 2026, 3:30 pm" (Singapore time), used in notification text
export function formatDateTime(d) {
  if (!d) return ''
  return new Date(d).toLocaleString('en-SG', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Singapore' })
}
