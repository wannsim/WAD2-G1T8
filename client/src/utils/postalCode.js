// Singapore postal codes are exactly 6 digits, e.g. "570123".
// Written test-first (TDD demo) - see __tests__/postalCode.spec.js. Not used by any page yet.
export function isValidPostalCode(code) {
  return /^\d{6}$/.test(String(code ?? '').trim())
}
