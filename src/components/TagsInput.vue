<script setup>
import { ref } from 'vue'
import { mdiClose } from '@mdi/js'
import MdiIcon from './MdiIcon.vue'

const tags = defineModel({ type: Array, required: true })
const draft = ref('')

function commit() {
  for (const name of draft.value.split(',').map(s => s.trim()).filter(Boolean)) {
    if (!tags.value.some(t => t.toLowerCase() === name.toLowerCase())) tags.value.push(name)
  }
  draft.value = ''
}

function onKeydown(event) {
  if (event.key === 'Enter' || event.key === ',') {
    event.preventDefault()
    commit()
  } else if (event.key === 'Backspace' && !draft.value && tags.value.length) {
    tags.value.pop()
  }
}
</script>

<template>
  <div class="chips">
    <span v-for="(tag, i) in tags" :key="tag" class="chip">
      {{ tag }}
      <button type="button" :title="`Retirer ${tag}`" @click="tags.splice(i, 1)"><MdiIcon :path="mdiClose" :size="16" /></button>
    </span>
    <input v-model="draft" class="chip-input" placeholder="Ajouter un tag…" enterkeyhint="done" @keydown="onKeydown" @blur="commit" />
  </div>
</template>
