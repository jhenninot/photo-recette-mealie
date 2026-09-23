<script setup>
import { nextTick, ref } from 'vue'
import { mdiArrowUp, mdiClose, mdiPlus } from '@mdi/js'
import MdiIcon from './MdiIcon.vue'

const items = defineModel({ type: Array, required: true })
defineProps({
  // Étapes : affichées comme les cartes « Étape N » de Mealie
  steps: Boolean,
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
  <ol ref="list" class="list-editor">
    <li v-for="(item, i) in items" :key="i">
      <div v-if="steps" class="step-card">
        <header>
          <span>Étape {{ i + 1 }}</span>
          <span class="item-actions">
            <button type="button" class="btn icon" title="Monter" :disabled="i === 0" @click="move(i, -1)">
              <MdiIcon :path="mdiArrowUp" :size="20" />
            </button>
            <button type="button" class="btn icon" title="Supprimer" @click="remove(i)">
              <MdiIcon :path="mdiClose" :size="20" />
            </button>
          </span>
        </header>
        <textarea v-model="items[i]" rows="3" :aria-label="`Étape ${i + 1}`" />
      </div>
      <template v-else>
        <label class="field"><input v-model="items[i]" :aria-label="`Ingrédient ${i + 1}`" /></label>
        <button type="button" class="btn icon" title="Supprimer" @click="remove(i)">
          <MdiIcon :path="mdiClose" :size="20" />
        </button>
      </template>
    </li>
  </ol>
  <div class="row end">
    <button type="button" class="btn elevated success" @click="add">
      <MdiIcon :path="mdiPlus" :size="18" /> {{ addLabel }}
    </button>
  </div>
</template>
