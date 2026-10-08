<script setup>
// Display:  <StarRating :value="4.3" />
// Input:    <StarRating :value="rating" editable @rate="rating = $event" />
const props = defineProps({
  value: { type: Number, default: 0 },
  editable: { type: Boolean, default: false },
})
const emit = defineEmits(['rate'])

const stars = [1, 2, 3, 4, 5]

function rate(n) {
  if (props.editable) emit('rate', n)
}
</script>

<template>
  <span class="star-rating" :class="{ editable: editable }">
    <span v-for="n in stars" :key="n" :class="{ filled: n <= Math.round(value) }" @click="rate(n)">★</span>
  </span>
</template>

<style scoped>
.star-rating span {
  color: #ccc;
  font-size: 1.2rem;
}
.star-rating span.filled {
  color: #f59e0b;
}
.editable span {
  cursor: pointer;
}
</style>
