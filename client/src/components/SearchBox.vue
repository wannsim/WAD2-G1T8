<script setup>
// Owner: Cheyenne
// Rounded search input with a magnifier icon and a clear (x) button.
//   <SearchBox v-model="search" placeholder="Search orders..." />
const model = defineModel({ type: String, default: '' })
defineProps({
  placeholder: { type: String, default: 'Search...' },
  label: { type: String, default: 'Search' }, // read out by screen readers
})
</script>

<template>
  <div class="search-box">
    <svg class="search-icon" width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001q.044.06.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1 1 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0" />
    </svg>
    <input v-model="model" type="text" class="form-control" :placeholder="placeholder" :aria-label="label" @keydown.esc="model = ''" />
    <button v-if="model" type="button" class="clear-btn" aria-label="Clear search" @click="model = ''">&times;</button>
  </div>
</template>

<style scoped>
.search-box {
  position: relative;
}
.search-icon {
  position: absolute;
  top: 50%;
  left: 0.9rem;
  transform: translateY(-50%);
  color: var(--muted);
  pointer-events: none;
}
.form-control {
  padding-left: 2.3rem;
  padding-right: 2.2rem;
  border-radius: 999px;
}
.clear-btn {
  position: absolute;
  top: 50%;
  right: 0.6rem;
  transform: translateY(-50%);
  width: 24px;
  height: 24px;
  border: 0;
  border-radius: 50%;
  background: var(--surface-hover);
  color: var(--ink-soft);
  line-height: 1;
}
.clear-btn:hover {
  background: var(--line);
}
</style>
