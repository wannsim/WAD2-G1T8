<script setup>
import { ref, computed } from 'vue'
import { MRT_STATIONS, MRT_LINES, matchStation } from '@/utils/mrtStations'

// MRT station box with suggestions: type "bis" -> Bishan, Bras Basah... (filters as you type).
// Arrow keys + Enter pick one, Esc closes. The answer MUST be a station on the list: typing the full
// name (e.g. "bishan mrt") is tidied to "Bishan"; anything else shows an error (the page also checks on save).
//   <MrtSelect id="preferred-mrt" v-model="preferredMrt" placeholder="e.g. Bishan" />
const model = defineModel({ type: String, default: '' })
const props = defineProps({
  id: { type: String, required: true },
  placeholder: { type: String, default: 'Start typing a station' },
  required: Boolean,
})

const open = ref(false)
const active = ref(0) // highlighted suggestion
const touched = ref(false) // only show the error after the user has left the box once
const listId = computed(() => `${props.id}-list`)
const errorId = computed(() => `${props.id}-error`)

// stations whose name (or any word in it) starts with the text first, then ones that contain it
const matches = computed(() => {
  const q = String(model.value || '').replace(/\b(mrt|lrt)\b/gi, '').trim().toLowerCase()
  if (!q) return MRT_STATIONS // every station, A-Z (the list scrolls)
  const starts = []
  const contains = []
  for (const station of MRT_STATIONS) {
    const name = station.name.toLowerCase()
    if (name.startsWith(q) || name.split(/[\s-]/).some((word) => word.startsWith(q))) starts.push(station)
    else if (name.includes(q)) contains.push(station)
  }
  return [...starts, ...contains]
})

const empty = computed(() => !String(model.value || '').trim())
const error = computed(() => {
  if (!touched.value || open.value) return ''
  if (empty.value) return props.required ? 'Please choose your nearest MRT station.' : ''
  return matchStation(model.value) ? '' : 'Please choose a station from the list.'
})

function onInput() {
  open.value = true
  active.value = 0
}
function choose(station) {
  model.value = station.name
  open.value = false
  touched.value = true
}
function move(step) {
  if (!open.value) return (open.value = true)
  const count = matches.value.length
  if (count) active.value = (active.value + step + count) % count
}
function onEnter(event) {
  if (open.value && matches.value[active.value]) {
    event.preventDefault() // pick the station instead of submitting the form
    choose(matches.value[active.value])
  }
}
function onBlur() {
  open.value = false
  touched.value = true
  const exact = matchStation(model.value)
  if (exact) model.value = exact // "bishan mrt" -> "Bishan"
}
</script>

<template>
  <div class="mrt-select">
    <input :id="id" v-model="model" type="text" class="form-control" :class="{ 'is-invalid': error }" :placeholder="placeholder"
      :required="required" autocomplete="off" role="combobox" aria-autocomplete="list" :aria-expanded="open && matches.length > 0"
      :aria-controls="listId" :aria-invalid="!!error" :aria-describedby="error ? errorId : undefined"
      :aria-activedescendant="open && matches[active] ? `${id}-opt-${active}` : undefined"
      @input="onInput" @focus="open = true" @blur="onBlur"
      @keydown.down.prevent="move(1)" @keydown.up.prevent="move(-1)" @keydown.enter="onEnter" @keydown.esc="open = false" />

    <ul v-show="open" :id="listId" class="mrt-list" role="listbox">
      <!-- mousedown.prevent: picking a station doesn't blur the box first -->
      <li v-for="(station, i) in matches" :id="`${id}-opt-${i}`" :key="station.name" role="option" class="mrt-option"
        :class="{ active: i === active }" :aria-selected="i === active" @mousedown.prevent="choose(station)" @mouseenter="active = i">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M12.166 8.94c-.524 1.062-1.234 2.12-1.96 3.07A32 32 0 0 1 8 14.58a32 32 0 0 1-2.206-2.57c-.726-.95-1.436-2.008-1.96-3.07C3.304 7.867 3 6.862 3 6a5 5 0 0 1 10 0c0 .862-.305 1.867-.834 2.94M8 16s6-5.686 6-10A6 6 0 0 0 2 6c0 4.314 6 10 6 10" /><path d="M8 8a2 2 0 1 1 0-4 2 2 0 0 1 0 4m0 1a3 3 0 1 0 0-6 3 3 0 0 0 0 6" /></svg>
        <span class="mrt-name">{{ station.name }} <span class="mrt-tag">MRT</span></span>
        <span class="mrt-lines">
          <span v-for="code in station.lines" :key="code" class="mrt-line" :style="{ background: MRT_LINES[code]?.colour }"
            :title="MRT_LINES[code]?.name">{{ code }}</span>
        </span>
      </li>
      <li v-if="matches.length === 0" class="mrt-none" role="presentation">No station matches "{{ model }}". Check the spelling.</li>
    </ul>
    <div v-if="error" :id="errorId" class="invalid-feedback d-block" role="alert">{{ error }}</div>
  </div>
</template>

<style scoped>
.mrt-select {
  position: relative;
}
.mrt-list {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  z-index: 1050;
  max-height: 280px;
  margin: 0;
  padding: 0.3rem;
  overflow-y: auto;
  list-style: none;
  border: 1px solid var(--line);
  border-radius: 0.75rem;
  background: var(--surface);
  box-shadow: 0 10px 28px rgba(var(--navy-rgb), 0.14);
}
.mrt-option {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.45rem 0.6rem;
  border-radius: 0.5rem;
  color: var(--ink);
  cursor: pointer;
}
.mrt-option svg {
  flex-shrink: 0;
  color: var(--muted);
}
.mrt-option.active {
  background: var(--ocean-soft);
}
.mrt-name {
  flex: 1;
  min-width: 0;
}
.mrt-lines {
  display: inline-flex;
  flex-shrink: 0;
  gap: 0.2rem;
}
.mrt-line {
  padding: 0.05rem 0.35rem;
  border-radius: 0.3rem;
  font-size: 0.68rem;
  font-weight: 700;
  color: #fff;
}
.mrt-tag {
  font-size: 0.75rem;
  color: var(--muted);
}
.mrt-none {
  padding: 0.5rem 0.6rem;
  font-size: 0.85rem;
  color: var(--muted);
}
</style>
