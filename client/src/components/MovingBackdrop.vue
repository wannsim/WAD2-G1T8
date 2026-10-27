<script setup>
import { ref, computed, onMounted } from 'vue'
import axios from 'axios'
import { API_URL } from '@/utils/config'
import { formatPrice } from '@/utils/format'

// Owner: Cheyenne
// Full-screen moving collage of our sellers' products behind the login page (like Shopify's sign-up page).
// Tilted columns of product cards drift up and down forever. Pure CSS animation: no library.
// Uses the public GET /discover (no login needed); if it fails, shows coloured placeholder tiles instead.
//   <MovingBackdrop />   (put it anywhere on the page - it is fixed behind everything)
const COLUMNS = 6
const products = ref([])

// placeholder tiles while loading / when offline, so the background is never empty
const FALLBACK = ['🧁', '🍵', '🧶', '🕯️', '🍪', '🥟', '🎁', '🍰', '🧋', '🌸', '🍛', '🖼️'].map((emoji, i) => ({ _id: `f${i}`, emoji }))

const columns = computed(() => {
  const items = products.value.length ? products.value : FALLBACK
  const cols = Array.from({ length: COLUMNS }, () => [])
  // each column starts at a different product, so neighbours never show the same thing side by side
  for (let c = 0; c < COLUMNS; c++) {
    for (let i = 0; i < Math.max(6, Math.ceil(items.length / 2)); i++) cols[c].push(items[(c * 3 + i) % items.length])
  }
  // every column is drawn twice in a row, so moving it by exactly half loops without a jump
  return cols.map((col) => [...col, ...col])
})

onMounted(async () => {
  try {
    const res = await axios.get(`${API_URL}/discover`)
    products.value = res.data.products.slice(0, 30)
  } catch (err) {
    // keep the placeholder tiles
  }
})

function hideBrokenImage(event) {
  event.target.style.visibility = 'hidden'
}
</script>

<template>
  <div class="backdrop" aria-hidden="true">
    <div class="tilt">
      <div v-for="(col, c) in columns" :key="c" class="column" :class="c % 2 ? 'down' : 'up'"
        :style="{ '--duration': `${46 + (c % 3) * 9}s` }">
        <div v-for="(p, i) in col" :key="`${p._id}-${i}`" class="tile" :class="`hue-${(c + i) % 4}`">
          <template v-if="p.emoji">
            <span class="emoji">{{ p.emoji }}</span>
          </template>
          <template v-else>
            <img :src="p.imageUrl" alt="" :loading="i < 4 ? 'eager' : 'lazy'" @error="hideBrokenImage" />
            <div class="caption">
              <span class="name">{{ p.name }}</span>
              <span class="price">{{ formatPrice(p.price) }}</span>
            </div>
          </template>
        </div>
      </div>
    </div>
    <div class="shade"></div>
  </div>
</template>

<style scoped>
.backdrop {
  position: fixed;
  inset: 0;
  z-index: -1; /* behind the page, above the body gradient */
  overflow: hidden;
  background: var(--navy);
}
/* the whole collage is tilted and oversized, so the edges never show */
.tilt {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 150vmax;
  display: flex;
  justify-content: center;
  gap: 1.1rem;
  transform: translate(-50%, -50%) rotate(-12deg);
}
.column {
  flex: 0 0 clamp(150px, 15vw, 230px);
  display: flex;
  flex-direction: column;
  gap: 1.1rem;
  animation: drift var(--duration) linear infinite;
  will-change: transform;
}
.column.down {
  animation-direction: reverse;
}
@keyframes drift {
  from { transform: translateY(0); }
  to { transform: translateY(calc(-50% - 0.55rem)); } /* half the column (it is drawn twice) + half a gap */
}

.tile {
  position: relative;
  aspect-ratio: 3 / 4;
  border-radius: 1.1rem;
  overflow: hidden;
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.35);
}
.tile img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.caption {
  position: absolute;
  left: 0.6rem;
  right: 0.6rem;
  bottom: 0.6rem;
  display: flex;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.45rem 0.65rem;
  border-radius: 0.7rem;
  background: rgba(255, 255, 255, 0.9);
  color: var(--navy);
  font-size: 0.75rem;
}
.caption .name {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.caption .price {
  flex-shrink: 0;
  font-weight: 700;
}
/* placeholder tiles: ocean colours */
.emoji {
  display: grid;
  place-items: center;
  height: 100%;
  font-size: 3.5rem;
}
.hue-0 { background: linear-gradient(160deg, #24498a, #13284b); }
.hue-1 { background: linear-gradient(160deg, #5b86c5, #1b3a70); }
.hue-2 { background: linear-gradient(160deg, #b4c9e8, #24498a); }
.hue-3 { background: linear-gradient(160deg, #3f6aa8, #13284b); }

/* darkens the collage so the login card in front is easy to read */
.shade {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(ellipse at center, rgba(19, 40, 75, 0.35) 0%, rgba(19, 40, 75, 0.75) 70%),
    linear-gradient(180deg, rgba(19, 40, 75, 0.25), rgba(19, 40, 75, 0.55));
}

/* people who turn off animations in their system settings get a still collage */
@media (prefers-reduced-motion: reduce) {
  .column { animation: none; }
}
</style>
