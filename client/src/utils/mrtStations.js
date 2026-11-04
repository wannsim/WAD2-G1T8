import data from '@/data/mrt-stations.json'

// Singapore MRT stations for the station boxes (components/MrtSelect.vue).
// The list comes from LTA's official open data on data.gov.sg - see data.source / data.downloaded in
// src/data/mrt-stations.json, rebuilt by:  node scripts/update-mrt-stations.mjs
// Names are stored WITHOUT "MRT" (e.g. "Bishan") - the map adds it (utils/googleMaps.js).
export const MRT_SOURCE = data.source
export const MRT_STATIONS = data.stations // [{ name: 'Bishan', lines: ['NS', 'CC'], lat, lng }, ...] sorted A-Z

// line badge colours (shown after each station name in the suggestions)
export const MRT_LINES = {
  NS: { name: 'North South Line', colour: '#d42e12' },
  EW: { name: 'East West Line', colour: '#009645' },
  CG: { name: 'Changi Airport Branch Line', colour: '#009645' },
  NE: { name: 'North East Line', colour: '#9900aa' },
  CC: { name: 'Circle Line', colour: '#fa9e0d' },
  DT: { name: 'Downtown Line', colour: '#005ec4' },
  TE: { name: 'Thomson-East Coast Line', colour: '#9d5b25' },
}

// "bishan mrt", " Bishan Station " -> "Bishan" (the list's spelling), or '' if it isn't a station on the list
export function matchStation(text) {
  const clean = String(text || '').replace(/\b(mrt|lrt)\b/gi, '').replace(/\bstation\b/gi, '').replace(/\s+/g, ' ').trim().toLowerCase()
  return MRT_STATIONS.find((s) => s.name.toLowerCase() === clean)?.name || ''
}
