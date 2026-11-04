import { describe, it, expect } from 'vitest'
import { CATEGORIES, toCategory, toCategories } from '../constants'

describe('TestSuite: CATEGORIES list', () => {
  it('Test1: has the original categories and ends with "Others"', () => {
    expect(CATEGORIES).toContain('Baked goods')
    expect(CATEGORIES).toContain('Handmade crafts')
    expect(CATEGORIES[CATEGORIES.length - 1]).toBe('Others')
  })

  it('Test2: has no category twice', () => {
    expect(new Set(CATEGORIES).size).toBe(CATEGORIES.length)
  })
})

describe('TestSuite: toCategory', () => {
  it('Test1: matches old text whatever the capitals or spaces', () => {
    expect(toCategory('baked goods')).toBe('Baked goods')
    expect(toCategory('  BAKED GOODS ')).toBe('Baked goods')
  })

  it('Test2: unknown, empty and missing text all become "Others"', () => {
    expect(toCategory('rocket ships')).toBe('Others')
    expect(toCategory('')).toBe('Others')
    expect(toCategory(null)).toBe('Others')
  })
})

describe('TestSuite: toCategories', () => {
  it('Test1: removes duplicates after matching', () => {
    expect(toCategories(['baked goods', 'Baked goods', 'xyz'])).toEqual(['Baked goods', 'Others'])
  })

  it('Test2: no list gives an empty list', () => {
    expect(toCategories(undefined)).toHaveLength(0)
  })
})
