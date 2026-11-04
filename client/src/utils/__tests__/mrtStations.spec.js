import { describe, it, expect } from 'vitest'
import { MRT_STATIONS, matchStation } from '../mrtStations'

describe('TestSuite: matchStation', () => {
  it('Test1: finds a station whatever the capitals, and drops "MRT"', () => {
    expect(matchStation('bishan mrt')).toBe('Bishan')
    expect(matchStation('BISHAN')).toBe('Bishan')
  })

  it('Test2: ignores "Station" and extra spaces, also for two-word names', () => {
    expect(matchStation('  Dhoby   Ghaut  MRT Station ')).toBe('Dhoby Ghaut')
  })

  it('Test3: a made-up station, or only part of a name, gives an empty string', () => {
    expect(matchStation('Hogwarts')).toBe('')
    expect(matchStation('Bish')).toBe('')
  })

  it('Test4: empty and missing text give an empty string', () => {
    expect(matchStation('')).toBe('')
    expect(matchStation(null)).toBe('')
  })
})

describe('TestSuite: MRT_STATIONS list', () => {
  it('Test1: every station has a name and at least one line', () => {
    expect(MRT_STATIONS.length > 100).toBeTruthy()
    expect(MRT_STATIONS.every((s) => s.name && s.lines.length > 0)).toBe(true)
  })
})
