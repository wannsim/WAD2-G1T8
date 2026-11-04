import { describe, it, expect } from 'vitest'
import { checkProduct, toPrice, cleanTags } from '../productRules.js'

// a listing that passes every rule; each test changes one thing
const goodProduct = { name: 'Biscoff cookies', category: 'Baked goods', description: 'Crunchy', price: '6.50', unit: 'box' }

describe('TestSuite: checkProduct', () => {
  it('Test1: a complete listing has no error', () => {
    expect(checkProduct(goodProduct)).toBe('')
  })

  it('Test2: a missing or blank name is refused', () => {
    expect(checkProduct({ ...goodProduct, name: '' })).toBe('Name is required.')
    expect(checkProduct({ ...goodProduct, name: '   ' })).toBe('Name is required.')
  })

  it('Test3: a category that is not on the list is refused', () => {
    expect(checkProduct({ ...goodProduct, category: 'Rocket ships' })).toBe('Please pick a category from the list.')
  })

  it('Test4: price must be a number with at most 2 decimal places', () => {
    expect(checkProduct({ ...goodProduct, price: '6' })).toBe('')
    expect(checkProduct({ ...goodProduct, price: '6.555' })).toContain('at most 2 decimal places')
    expect(checkProduct({ ...goodProduct, price: '-5' })).toContain('at most 2 decimal places')
    expect(checkProduct({ ...goodProduct, price: 'abc' })).toContain('at most 2 decimal places')
  })

  it('Test5: a listing with no photo is refused', () => {
    expect(checkProduct(goodProduct, { missingImage: true })).toBe('Please add at least one photo.')
  })
})

describe('TestSuite: toPrice and cleanTags', () => {
  it('Test1: toPrice turns the typed price into a number', () => {
    expect(toPrice('6')).toBe(6)
    expect(toPrice('6.50')).toBe(6.5)
  })

  it('Test2: cleanTags trims, lowercases and removes blanks and duplicates', () => {
    expect(cleanTags(['Gift', ' gift ', 'Keychain', ''])).toEqual(['gift', 'keychain'])
    expect(cleanTags(undefined)).toEqual([])
  })
})
