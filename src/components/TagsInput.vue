<script setup>
import { computed, ref, useId } from 'vue'
import { mdiClose } from '@mdi/js'
import MdiIcon from './MdiIcon.vue'

const tags = defineModel({ type: Array, required: true })
const props = defineProps({
  placeholder: { type: String, default: 'Ajouter un tag…' },
  // Valeurs existantes proposées pendant la saisie
  suggestions: { type: Array, default: () => [] }
})
const draft = ref('')
const listId = useId()
const available = computed(() => props.suggestions.filter(s => !tags.value.some(t => t.toLowerCase() === s.toLowerCase())))

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
    <input v-model="draft" class="chip-input" :placeholder="placeholder" :list="suggestions.length ? listId : undefined"
      enterkeyhint="done" @keydown="onKeydown" @change="commit" @blur="commit" />
    <datalist v-if="suggestions.length" :id="listId">
      <option v-for="s in available" :key="s" :value="s" />
    </datalist>
  </div>
</template>
