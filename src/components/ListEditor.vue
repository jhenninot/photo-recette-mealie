<script setup>
import { nextTick, ref } from 'vue'

const items = defineModel({ type: Array, required: true })
defineProps({
  numbered: Boolean,
  multiline: Boolean,
  addLabel: { type: String, default: 'Ajouter' }
})

const list = ref(null)

async function add() {
  items.value.push('')
  await nextTick()
  list.value?.querySelector('li:last-child :is(input, textarea)')?.focus()
}

function remove(index) {
  items.value.splice(index, 1)
}

function move(index, delta) {
  const target = index + delta
  if (target < 0 || target >= items.value.length) return
  const [item] = items.value.splice(index, 1)
  items.value.splice(target, 0, item)
}
</script>

<template>
  <ol ref="list" class="list-editor" :class="{ numbered }">
    <li v-for="(item, i) in items" :key="i">
      <span v-if="numbered" class="index">{{ i + 1 }}</span>
      <textarea v-if="multiline" v-model="items[i]" rows="3" />
      <input v-else v-model="items[i]" />
      <div class="item-actions">
        <button v-if="numbered" type="button" class="icon" title="Monter" :disabled="i === 0" @click="move(i, -1)">↑</button>
        <button type="button" class="icon" title="Supprimer" @click="remove(i)">✕</button>
      </div>
    </li>
  </ol>
  <button type="button" class="ghost small" @click="add">+ {{ addLabel }}</button>
</template>
