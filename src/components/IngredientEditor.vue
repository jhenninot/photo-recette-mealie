<script setup>
import { nextTick, ref } from 'vue'
import { mdiClose, mdiPlus } from '@mdi/js'
import MdiIcon from './MdiIcon.vue'

// Ingrédients structurés comme dans Mealie : quantité, unité, aliment, note
const items = defineModel({ type: Array, required: true })
defineProps({
  // Noms d'unités existantes dans Mealie, proposés en suggestion
  units: { type: Array, default: () => [] }
})

const list = ref(null)

async function add() {
  items.value.push({ quantity: null, unit: '', food: '', note: '' })
  await nextTick()
  list.value?.querySelector('li:last-child input')?.focus()
}

function remove(index) {
  items.value.splice(index, 1)
}
</script>

<template>
  <datalist id="mealie-units">
    <option v-for="unit in units" :key="unit" :value="unit" />
  </datalist>
  <ol ref="list" class="list-editor">
    <li v-for="(item, i) in items" :key="i">
      <div class="ingredient-card">
        <div class="ingredient-grid">
          <label class="field qty"><span>Qté</span>
            <input v-model.number="item.quantity" type="number" min="0" step="any" inputmode="decimal" />
          </label>
          <label class="field"><span>Unité</span><input v-model="item.unit" list="mealie-units" /></label>
          <label class="field food"><span>Aliment</span><input v-model="item.food" /></label>
          <label class="field note"><span>Note</span><input v-model="item.note" /></label>
        </div>
        <button type="button" class="btn icon" title="Supprimer" @click="remove(i)">
          <MdiIcon :path="mdiClose" :size="20" />
        </button>
      </div>
    </li>
  </ol>
  <div class="row end">
    <button type="button" class="btn elevated success" @click="add">
      <MdiIcon :path="mdiPlus" :size="18" /> Ingrédient
    </button>
  </div>
</template>
