<script setup>
import { computed } from 'vue'
import { CATEGORIES } from '@/utils/constants'

// Dropdown with a tick box per category (the shared list in utils/constants.js). Pick as many as you like.
//   <CategoryMultiSelect v-model="profile.categories" id="shop-categories" />
// Looks like a normal select; the chosen ones show as chips inside it (× removes one).
const selected = defineModel({ type: Array, default: () => [] })
defineProps({ id: { type: String, default: 'category-select' } })

const isChosen = (c) => selected.value.includes(c)
function toggle(c) {
  selected.value = isChosen(c) ? selected.value.filter((x) => x !== c) : CATEGORIES.filter((x) => x === c || isChosen(x)) // keep list order
}
const summary = computed(() => (selected.value.length ? `${selected.value.length} selected` : 'Select categories'))
</script>

<template>
  <div class="dropdown cat-select">
    <!-- data-bs-auto-close="outside": stays open while ticking several boxes -->
    <button :id="id" type="button" class="form-select cat-toggle text-start" data-bs-toggle="dropdown"
      data-bs-auto-close="outside" aria-expanded="false" :aria-label="`Categories: ${summary}`">
      <span v-if="!selected.length" class="placeholder-text">Select categories</span>
      <span v-for="c in selected" :key="c" class="cat-chip">
        {{ c }}
        <span class="chip-x" role="button" tabindex="0" :aria-label="`Remove ${c}`"
          @click.stop="toggle(c)" @keydown.enter.stop.prevent="toggle(c)">&times;</span>
      </span>
    </button>
    <ul class="dropdown-menu cat-menu w-100" :aria-labelledby="id">
      <li v-for="c in CATEGORIES" :key="c">
        <label class="dropdown-item cat-option">
          <input type="checkbox" class="form-check-input m-0" :checked="isChosen(c)" @change="toggle(c)" />
          {{ c }}
        </label>
      </li>
      <li v-if="selected.length"><hr class="dropdown-divider" /></li>
      <li v-if="selected.length">
        <button type="button" class="dropdown-item small text-muted" @click="selected = []">Clear all</button>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.cat-toggle {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.35rem;
  min-height: 38px;
  padding-top: 0.3rem;
  padding-bottom: 0.3rem;
  cursor: pointer;
}
.placeholder-text {
  color: var(--muted);
}
.cat-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.1rem 0.25rem 0.1rem 0.6rem;
  border-radius: 999px;
  background: var(--ocean-soft);
  font-size: 0.82rem;
  color: var(--ocean-dark);
}
.chip-x {
  display: inline-grid;
  place-items: center;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  font-size: 0.95rem;
  line-height: 1;
}
.chip-x:hover,
.chip-x:focus-visible {
  background: rgba(var(--ocean-rgb), 0.15);
}
.cat-menu {
  max-height: 320px;
  overflow-y: auto;
}
.cat-option {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  cursor: pointer;
}
</style>
