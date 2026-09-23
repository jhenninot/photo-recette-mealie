<script setup>
// Icône Material Design (mêmes icônes que Mealie), passée sous forme de chemin SVG depuis @mdi/js
defineProps({
  path: { type: String, required: true },
  size: { type: [Number, String], default: 24 }
})
</script>

<template>
  <svg class="mdi" :width="size" :height="size" viewBox="0 0 24 24" aria-hidden="true">
    <path :d="path" fill="currentColor" />
  </svg>
</template>
