// Rebuilds src/data/mrt-stations.json from LTA's official open data (data.gov.sg). Run when stations change:
//   cd client && node scripts/update-mrt-stations.mjs
//
// Sources (Land Transport Authority, via data.gov.sg, Singapore Open Data Licence):
//   - "LTA MRT Station Exit (GEOJSON)"  d_b39d3a0871985372d7e1637193335da5
//       every station exit with its location. A station with exits = a station that exists, so this is
//       the list of stations; each station's location is the average of its exits.
//   - "Train Station Chinese Names"     d_d312a5b127e1ae74299b8ae664cedd4e
//       official English spelling / capitals (e.g. "HarbourFront", "one-north") and station codes
//       (NS1, EW24...), which give each station's lines. This file is from 2024: it has no Thomson-East
//       Coast Line and misses a few newer stations, so those names are title-cased from the exits list
//       and their lines come from ADDED_BY_HAND below (not from a dataset - check them if lines change).
// Only MRT stations are kept (LRT stations are left out, like before).
import { writeFile, mkdir } from 'node:fs/promises'

const EXITS_ID = 'd_b39d3a0871985372d7e1637193335da5'
const NAMES_ID = 'd_d312a5b127e1ae74299b8ae664cedd4e'
const OUT = new URL('../src/data/mrt-stations.json', import.meta.url)

// station code prefix -> line (CE = Circle Line extension, shown as the Circle Line). LRT prefixes are skipped.
const CODE_TO_LINE = { NS: 'NS', EW: 'EW', CG: 'CG', NE: 'NE', CC: 'CC', CE: 'CC', DT: 'DT', TE: 'TE' }
// lines the 2024 code list doesn't have yet (written by hand, NOT from the dataset)
const TE_STATIONS = ['Woodlands North', 'Woodlands', 'Woodlands South', 'Springleaf', 'Lentor', 'Mayflower', 'Bright Hill',
  'Upper Thomson', 'Caldecott', 'Stevens', 'Napier', 'Orchard Boulevard', 'Orchard', 'Great World', 'Havelock', 'Outram Park',
  'Maxwell', 'Shenton Way', 'Marina Bay', 'Marina South', 'Gardens by the Bay', 'Tanjong Rhu', 'Katong Park', 'Tanjong Katong',
  'Marine Parade', 'Marine Terrace', 'Siglap', 'Bayshore']
const ADDED_BY_HAND = {
  ...Object.fromEntries(TE_STATIONS.map((name) => [name, ['TE']])),
  Canberra: ['NS'],
  Hume: ['DT'],
  'Punggol Coast': ['NE'],
  Cantonment: ['CC'],
  Keppel: ['CC'],
  'Prince Edward Road': ['CC'],
  'Tanah Merah': ['CG'], // the Changi Airport branch starts here
}

// data.gov.sg gives a short-lived download link for each dataset
async function download(datasetId) {
  const poll = await fetch(`https://api-open.data.gov.sg/v1/public/api/datasets/${datasetId}/poll-download`).then((r) => r.json())
  if (!poll?.data?.url) throw new Error(`No download link for ${datasetId}: ${JSON.stringify(poll).slice(0, 200)}`)
  const res = await fetch(poll.data.url)
  if (!res.ok) throw new Error(`Download failed for ${datasetId}: HTTP ${res.status}`)
  return res.text()
}

// "MARINE PARADE" -> "Marine Parade" ("Gardens by the Bay": small words stay small)
const SMALL_WORDS = new Set(['by', 'the', 'of', 'and'])
const titleCase = (text) => text.toLowerCase().split(' ')
  .map((word, i) => (i > 0 && SMALL_WORDS.has(word) ? word : word.charAt(0).toUpperCase() + word.slice(1)))
  .join(' ')

// tiny CSV reader (the names file has no quoted commas)
function readCsv(text) {
  const [header, ...lines] = text.replace(/^﻿/, '').trim().split(/\r?\n/)
  const keys = header.split(',')
  return lines.map((line) => Object.fromEntries(line.split(',').map((value, i) => [keys[i], value.trim()])))
}

const [exitsText, namesText] = await Promise.all([download(EXITS_ID), download(NAMES_ID)])

// official spelling + lines (from the station codes), looked up by lower case name
const spelling = new Map()
const linesOf = new Map()
for (const row of readCsv(namesText)) {
  const key = row.mrt_station_english.toLowerCase()
  spelling.set(key, row.mrt_station_english)
  const line = CODE_TO_LINE[(row.stn_code.match(/^[A-Z]+/) || [''])[0]]
  if (!line) continue // LRT
  if (!linesOf.has(key)) linesOf.set(key, new Set())
  linesOf.get(key).add(line)
}
const LINE_ORDER = ['NS', 'EW', 'CG', 'NE', 'CC', 'DT', 'TE']
function linesFor(name) {
  const set = new Set(linesOf.get(name.toLowerCase()) || [])
  for (const line of ADDED_BY_HAND[name] || []) set.add(line)
  return LINE_ORDER.filter((line) => set.has(line))
}

// group the exits by station
const stations = new Map()
for (const feature of JSON.parse(exitsText).features) {
  const raw = String(feature.properties.STATION_NA || '').trim()
  if (!/ MRT STATION$/.test(raw)) continue // LRT stations are left out
  const upper = raw.replace(/ MRT STATION$/, '')
  const [lng, lat] = feature.geometry.coordinates
  if (!stations.has(upper)) stations.set(upper, { lats: [], lngs: [] })
  stations.get(upper).lats.push(lat)
  stations.get(upper).lngs.push(lng)
}

const average = (list) => list.reduce((sum, n) => sum + n, 0) / list.length
const list = [...stations.entries()]
  .map(([upper, { lats, lngs }]) => {
    const name = spelling.get(upper.toLowerCase()) || titleCase(upper)
    return { name, lines: linesFor(name), lat: Number(average(lats).toFixed(5)), lng: Number(average(lngs).toFixed(5)) }
  })
  .sort((a, b) => a.name.localeCompare(b.name))

const noLine = list.filter((s) => s.lines.length === 0).map((s) => s.name)
if (noLine.length) console.warn(`No line known for: ${noLine.join(', ')} - add them to ADDED_BY_HAND`)

const output = {
  source: 'Land Transport Authority, "LTA MRT Station Exit (GEOJSON)" and "Train Station Chinese Names", data.gov.sg (Singapore Open Data Licence)',
  linesNote: 'Lines come from the station codes in "Train Station Chinese Names" (2024); Thomson-East Coast Line and newer stations were added by hand in scripts/update-mrt-stations.mjs',
  downloaded: new Date().toISOString().slice(0, 10),
  stations: list,
}
await mkdir(new URL('.', OUT), { recursive: true })
await writeFile(OUT, JSON.stringify(output, null, 2) + '\n')
console.log(`Saved ${list.length} MRT stations to src/data/mrt-stations.json`)
