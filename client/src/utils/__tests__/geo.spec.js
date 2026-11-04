import { describe, it, expect } from 'vitest'
import { distanceKm, approximateLocation } from '../geo'

// distances are decimals, so these use toBeCloseTo (an extra matcher, not in the slides' list)
describe('TestSuite: distanceKm', () => {
  it('Test1: the same point is 0 km away', () => {
    expect(distanceKm(1.3521, 103.8198, 1.3521, 103.8198)).toBe(0)
  })

  it('Test2: 1 degree of latitude is about 111.2 km', () => {
    expect(distanceKm(0, 0, 1, 0)).toBeCloseTo(111.19, 1)
  })

  it('Test3: gives the same distance in both directions', () => {
    const there = distanceKm(1.3521, 103.8198, 1.2903, 103.852)
    const back = distanceKm(1.2903, 103.852, 1.3521, 103.8198)
    expect(there).toBeCloseTo(back, 10)
  })
})

describe('TestSuite: approximateLocation', () => {
  it('Test1: rounds to 2 decimal places so the exact home is hidden', () => {
    expect(approximateLocation(1.35678, 103.81234)).toEqual({ lat: 1.36, lng: 103.81 })
  })
})
