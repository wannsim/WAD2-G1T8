<script setup>
import { onMounted, onUnmounted } from 'vue'
import axios from 'axios'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { API_URL } from '@/utils/config'

// Owner: Member 3 - Leaflet map with OpenStreetMap tiles (listed in our proposal's API section).
// Leaflet is not covered in class: read https://leafletjs.com/examples/quick-start/
let map = null

onMounted(async () => {
  map = L.map('map').setView([1.3521, 103.8198], 12) // centre of Singapore
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors',
  }).addTo(map)

  try {
    const response = await axios.get(`${API_URL}/shops`)
    response.data.forEach((shop) => {
      if (!shop.location || !shop.location.lat) return

      // build the popup with DOM elements + textContent so shop names can never inject HTML
      const popup = document.createElement('div')
      const title = document.createElement('strong')
      title.textContent = shop.name
      const mrt = document.createElement('div')
      mrt.textContent = shop.nearestMrt ? `${shop.nearestMrt} MRT` : ''
      const link = document.createElement('a')
      link.href = `/shops/${shop._id}`
      link.textContent = 'View shop'
      popup.append(title, mrt, link)

      L.circleMarker([shop.location.lat, shop.location.lng], {
        radius: 10,
        color: '#c2410c',
        fillOpacity: 0.7,
      })
        .addTo(map)
        .bindPopup(popup)
    })
  } catch (error) {
    console.log(error.message)
  }
})

onUnmounted(() => {
  if (map) map.remove() // clean up when leaving the page (Week 5: onUnmounted)
})

// TODO (Member 3): product preview inside the popup, radius filter, distance from the user (see utils/geo.js)
</script>

<template>
  <div>
    <div class="d-flex justify-content-between align-items-center mb-3">
      <h2>Map</h2>
      <RouterLink to="/browse" class="btn btn-outline-secondary btn-sm">Switch to list</RouterLink>
    </div>
    <div id="map"></div>
  </div>
</template>

<style scoped>
#map {
  height: 70vh;
  border-radius: 8px;
}
</style>
