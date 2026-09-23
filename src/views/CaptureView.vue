<script setup>
import { computed, reactive, ref } from 'vue'
import { api, compressImage } from '../api.js'
import ListEditor from '../components/ListEditor.vue'

const MAX_PHOTOS = 4

const step = ref('photos') // photos → review → done
const photos = ref([]) // [{ file, url }]
const extracting = ref(false)
const error = ref('')

const recipe = ref(null)
const tagsText = ref('')
const image = reactive({ loading: false, data: null, mimeType: null, error: '' })
const sending = ref(false)
const result = ref(null)

const imageSrc = computed(() => image.data ? `data:${image.mimeType};base64,${image.data}` : null)

function addPhotos(event) {
  const files = [...event.target.files].filter(f => f.type.startsWith('image/'))
  for (const file of files.slice(0, MAX_PHOTOS - photos.value.length)) {
    photos.value.push({ file, url: URL.createObjectURL(file) })
  }
  event.target.value = ''
}

function removePhoto(index) {
  URL.revokeObjectURL(photos.value[index].url)
  photos.value.splice(index, 1)
}

function clearPhotos() {
  photos.value.forEach(p => URL.revokeObjectURL(p.url))
  photos.value = []
}

async function extract() {
  error.value = ''
  extracting.value = true
  try {
    const form = new FormData()
    for (const [i, photo] of photos.value.entries()) {
      form.append('photos', await compressImage(photo.file), `page-${i + 1}.jpg`)
    }
    const data = await api('/recipes/extract', { method: 'POST', form })
    recipe.value = data.recipe
    tagsText.value = (data.recipe.tags || []).join(', ')
    // La photo originale n'est pas conservée
    clearPhotos()
    step.value = 'review'
    generateImage()
  } catch (err) {
    error.value = err.message
  } finally {
    extracting.value = false
  }
}

async function generateImage() {
  image.loading = true
  image.error = ''
  try {
    const { image: generated } = await api('/recipes/image', { method: 'POST', body: { recipe: recipe.value } })
    image.data = generated.data
    image.mimeType = generated.mimeType
  } catch (err) {
    image.error = err.message
  } finally {
    image.loading = false
  }
}

async function send() {
  error.value = ''
  sending.value = true
  try {
    const payload = {
      ...recipe.value,
      ingredients: recipe.value.ingredients.map(s => s.trim()).filter(Boolean),
      instructions: recipe.value.instructions.map(s => s.trim()).filter(Boolean),
      tags: tagsText.value.split(',').map(s => s.trim()).filter(Boolean)
    }
    result.value = await api('/recipes/mealie', {
      method: 'POST',
      body: { recipe: payload, image: image.data ? { data: image.data, mimeType: image.mimeType } : null }
    })
    step.value = 'done'
  } catch (err) {
    error.value = err.message
  } finally {
    sending.value = false
  }
}

function restart() {
  if (step.value === 'review' && !confirm('Abandonner cette recette ?')) return
  clearPhotos()
  recipe.value = null
  Object.assign(image, { loading: false, data: null, mimeType: null, error: '' })
  result.value = null
  error.value = ''
  step.value = 'photos'
}
</script>

<template>
  <!-- Étape 1 : photos -->
  <section v-if="step === 'photos'" class="stack">
    <div>
      <h2>Photographier une recette</h2>
      <p class="muted">Prenez la page du livre bien à plat, avec un bon éclairage. Si la recette tient sur deux pages, ajoutez plusieurs photos (jusqu'à {{ MAX_PHOTOS }}).</p>
    </div>

    <div v-if="photos.length" class="thumbs">
      <figure v-for="(photo, i) in photos" :key="photo.url">
        <img :src="photo.url" :alt="`Page ${i + 1}`" />
        <button class="icon remove" title="Retirer" :disabled="extracting" @click="removePhoto(i)">✕</button>
      </figure>
    </div>

    <div v-if="photos.length < MAX_PHOTOS && !extracting" class="row stretch">
      <label class="button primary grow">
        📷 {{ photos.length ? 'Ajouter une page' : 'Prendre une photo' }}
        <input type="file" accept="image/*" capture="environment" hidden @change="addPhotos" />
      </label>
      <label class="button grow">
        🖼️ Galerie
        <input type="file" accept="image/*" multiple hidden @change="addPhotos" />
      </label>
    </div>

    <p v-if="error" class="error">{{ error }}</p>

    <button v-if="photos.length" class="primary big" :disabled="extracting" @click="extract">
      <span v-if="extracting" class="spinner" /> {{ extracting ? 'Lecture de la recette…' : 'Analyser la recette' }}
    </button>
  </section>

  <!-- Étape 2 : relecture -->
  <section v-else-if="step === 'review'" class="stack">
    <div class="row between">
      <h2>Vérifier la recette</h2>
      <button class="ghost small" @click="restart">Annuler</button>
    </div>

    <div class="generated">
      <img v-if="imageSrc" :src="imageSrc" alt="Image générée du plat" :class="{ dim: image.loading }" />
      <div v-else class="placeholder">
        <template v-if="image.loading"><span class="spinner" /> Gemini prépare une photo du plat…</template>
        <template v-else-if="image.error">{{ image.error }}</template>
      </div>
      <button class="small regen" :disabled="image.loading" @click="generateImage">
        {{ image.loading ? 'Génération…' : imageSrc ? '↻ Autre image' : '↻ Réessayer' }}
      </button>
    </div>

    <label>Nom<input v-model="recipe.name" required /></label>
    <label>Description<textarea v-model="recipe.description" rows="3" /></label>

    <div class="grid">
      <label>Portions<input v-model="recipe.recipeYield" placeholder="4 personnes" /></label>
      <label>Préparation<input v-model="recipe.prepTime" placeholder="20 min" /></label>
      <label>Cuisson<input v-model="recipe.cookTime" placeholder="45 min" /></label>
      <label>Total<input v-model="recipe.totalTime" placeholder="1 h 05" /></label>
    </div>

    <fieldset>
      <legend>Ingrédients ({{ recipe.ingredients.length }})</legend>
      <ListEditor v-model="recipe.ingredients" add-label="Ingrédient" />
    </fieldset>

    <fieldset>
      <legend>Étapes ({{ recipe.instructions.length }})</legend>
      <ListEditor v-model="recipe.instructions" numbered multiline add-label="Étape" />
    </fieldset>

    <label>Tags <small class="muted">(séparés par des virgules)</small><input v-model="tagsText" /></label>
    <label>Conseils / notes<textarea v-model="recipe.notes" rows="2" /></label>
    <label>Source<input v-model="recipe.source" placeholder="Livre, auteur, page" /></label>

    <p v-if="error" class="error">{{ error }}</p>

    <div class="sticky-actions">
      <button class="primary big" :disabled="sending || image.loading || !recipe.name?.trim()" @click="send">
        <span v-if="sending" class="spinner" />
        {{ sending ? 'Envoi…' : image.loading ? 'Image en cours…' : imageSrc ? 'Envoyer dans Mealie' : 'Envoyer sans image' }}
      </button>
    </div>
  </section>

  <!-- Étape 3 : terminé -->
  <section v-else class="stack center">
    <div class="success">✓</div>
    <h2>« {{ recipe.name }} » est dans Mealie</h2>
    <img v-if="imageSrc" :src="imageSrc" alt="" class="done-image" />
    <a class="button" :href="result.url" target="_blank" rel="noopener">Ouvrir dans Mealie</a>
    <button class="primary big" @click="restart">📷 Nouvelle recette</button>
  </section>
</template>
