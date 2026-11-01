<script setup>
// Grey placeholder shapes shown while a page loads, so the layout appears straight away
// instead of an empty page or a "Loading..." line.
//   <PageSkeleton variant="grid" />            product / shop cards       (count = how many cards)
//   <PageSkeleton variant="list" :count="3" /> rows with a picture on the left (orders, reviews)
//   <PageSkeleton variant="list" compact />    small rows (notifications, shop list on the map)
//   <PageSkeleton variant="detail" />          big photo + text (product page)
//   <PageSkeleton variant="shop" />            banner + avatar + cards (shop pages)
//   <PageSkeleton variant="dashboard" />       4 number tiles + a list (orders dashboard, analytics)
//   <PageSkeleton variant="form" />            labels + boxes (forms)
defineProps({
  variant: { type: String, default: 'grid' },
  count: { type: Number, default: 0 }, // 0 = a sensible default for the variant
  compact: Boolean,
  label: { type: String, default: 'Loading' },
})
const DEFAULT_COUNT = { grid: 8, list: 4, shop: 4, form: 5 }
</script>

<template>
  <div class="skeleton" role="status" aria-live="polite" :aria-label="label">
    <span class="visually-hidden">{{ label }}…</span>

    <!-- cards -->
    <div v-if="variant === 'grid'" class="sk-grid">
      <div v-for="n in count || DEFAULT_COUNT.grid" :key="n" class="sk-card">
        <div class="sk sk-photo"></div>
        <div class="sk sk-line w-75"></div>
        <div class="sk sk-line w-50"></div>
        <div class="sk sk-line sk-small w-25"></div>
      </div>
    </div>

    <!-- rows -->
    <div v-else-if="variant === 'list'" class="d-flex flex-column" :class="compact ? 'gap-2' : 'gap-3'">
      <div v-for="n in count || DEFAULT_COUNT.list" :key="n" class="sk-row" :class="{ compact }">
        <div class="sk sk-thumb"></div>
        <div class="flex-grow-1">
          <div class="sk sk-line w-50"></div>
          <div class="sk sk-line sk-small w-75"></div>
          <div v-if="!compact" class="sk sk-line sk-small w-25"></div>
        </div>
      </div>
    </div>

    <!-- product page -->
    <div v-else-if="variant === 'detail'" class="row g-4">
      <div class="col-md-6"><div class="sk sk-square"></div></div>
      <div class="col-md-6">
        <div class="sk sk-title w-75"></div>
        <div class="sk sk-line w-25 mb-4"></div>
        <div class="sk sk-title w-25 mb-4"></div>
        <div class="sk sk-line"></div>
        <div class="sk sk-line w-75"></div>
        <div class="sk sk-line w-50 mb-4"></div>
        <div class="d-flex gap-2"><div class="sk sk-button"></div><div class="sk sk-button"></div></div>
      </div>
    </div>

    <!-- shop page -->
    <div v-else-if="variant === 'shop'">
      <div class="sk sk-banner"></div>
      <div class="d-flex align-items-center gap-3 mb-4">
        <div class="sk sk-avatar"></div>
        <div class="flex-grow-1"><div class="sk sk-title w-50"></div><div class="sk sk-line w-75"></div></div>
      </div>
      <div class="sk-grid">
        <div v-for="n in count || DEFAULT_COUNT.shop" :key="n" class="sk-card">
          <div class="sk sk-photo"></div>
          <div class="sk sk-line w-75"></div>
          <div class="sk sk-line w-50"></div>
        </div>
      </div>
    </div>

    <!-- dashboard -->
    <div v-else-if="variant === 'dashboard'">
      <div class="sk-tiles mb-4">
        <div v-for="n in 4" :key="n" class="sk-tile">
          <div class="sk sk-line sk-small w-50"></div>
          <div class="sk sk-title w-25"></div>
          <div class="sk sk-line sk-small w-75"></div>
        </div>
      </div>
      <div class="d-flex flex-column gap-3">
        <div v-for="n in count || 3" :key="n" class="sk-row">
          <div class="sk sk-thumb"></div>
          <div class="flex-grow-1">
            <div class="sk sk-line w-50"></div>
            <div class="sk sk-line sk-small w-75"></div>
            <div class="sk sk-line sk-small w-25"></div>
          </div>
        </div>
      </div>
    </div>

    <!-- form -->
    <div v-else-if="variant === 'form'" class="sk-form">
      <div class="sk sk-title w-50 mb-4"></div>
      <div v-for="n in count || DEFAULT_COUNT.form" :key="n" class="mb-3">
        <div class="sk sk-line sk-small w-25"></div>
        <div class="sk sk-input"></div>
      </div>
      <div class="sk sk-button w-100"></div>
    </div>
  </div>
</template>

<style scoped>
/* one shape: soft pink with a light sweep moving across it */
.sk {
  position: relative;
  overflow: hidden;
  border-radius: 0.6rem;
  background: var(--tile-hover);
}
.sk::after {
  content: '';
  position: absolute;
  inset: 0;
  transform: translateX(-100%);
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.6), transparent);
  animation: sweep 1.4s ease-in-out infinite;
}
@keyframes sweep {
  to { transform: translateX(100%); }
}
@media (prefers-reduced-motion: reduce) {
  .sk::after { animation: none; }
}

.sk-line { height: 0.85rem; margin-bottom: 0.6rem; }
.sk-small { height: 0.7rem; }
.sk-title { height: 1.6rem; margin-bottom: 0.8rem; border-radius: 0.5rem; }
.sk-photo { aspect-ratio: 4 / 3; margin-bottom: 0.9rem; border-radius: 1rem; }
.sk-square { aspect-ratio: 1; border-radius: 1.25rem; }
.sk-thumb { flex-shrink: 0; width: 72px; height: 72px; border-radius: 0.9rem; }
.compact .sk-thumb { width: 40px; height: 40px; border-radius: 50%; }
.sk-banner { height: 140px; margin-bottom: 1.25rem; border-radius: 1.25rem; }
.sk-avatar { flex-shrink: 0; width: 72px; height: 72px; border-radius: 50%; }
.sk-button { width: 160px; height: 46px; border-radius: 999px; }
.sk-input { height: 44px; border-radius: 0.75rem; }

/* same grid as .card-grid in main.css */
.sk-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 1.25rem;
}
.sk-card,
.sk-row,
.sk-tile {
  padding: 1rem;
  border: 1px solid var(--line);
  border-radius: 1.25rem;
  background: var(--surface);
}
.sk-row {
  display: flex;
  align-items: center;
  gap: 1rem;
}
.sk-row.compact { padding: 0.7rem 0.9rem; border-radius: 0.9rem; }
.sk-row .sk-line:last-child { margin-bottom: 0; }
.sk-tiles {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 1rem;
}
.sk-form { max-width: 720px; }

@media (max-width: 991.98px) {
  .sk-tiles { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 575.98px) {
  .sk-tiles { grid-template-columns: 1fr; }
}
</style>
