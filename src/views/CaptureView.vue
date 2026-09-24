<script setup>
import { computed, reactive, ref } from 'vue'
import {
  mdiAccountGroup, mdiCamera, mdiCheck, mdiChefHat, mdiClockOutline, mdiClose, mdiFormatListChecks,
  mdiImageMultiple, mdiOpenInNew, mdiRefresh, mdiSend, mdiTag, mdiTextRecognition
} from '@mdi/js'
import { api, compressImage } from '../api.js'
import MdiIcon from '../components/MdiIcon.vue'
import ListEditor from '../components/ListEditor.vue'
import TagsInput from '../components/TagsInput.vue'

const MAX_PHOTOS = 4

const step = ref('photos') // photos → review → done
const photos = ref([]) // [{ file, url }]
const extracting = ref(false)
const error = ref('')

const recipe = ref(null)
const image = reactive({ loading: false, data: null, mimeType: null, error: '', disabled: false })
const sending = ref(false)
const result = ref(null)

const imageSrc = computed(() => image.data ? `data:${image.mimeType};base64,${image.data}` : null)
const times = computed(() => [
  ['Préparation', recipe.value?.prepTime],
  ['Cuisson', recipe.value?.cookTime],
  ['Total', recipe.value?.totalTime]
].filter(([, v]) => v))

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
    recipe.value = { ...data.recipe, tags: data.recipe.tags || [] }
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
    // Génération d'image impossible sur ce serveur : inutile de proposer de réessayer
    image.disabled = err.code === 'image-disabled'
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
      instructions: recipe.value.instructions.map(s => s.trim()).filter(Boolean)
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
  Object.assign(image, { loading: false, data: null, mimeType: null, error: '', disabled: false })
  result.value = null
  error.value = ''
  step.value = 'photos'
}
</script>

<template>
  <!-- Étape 1 : photos -->
  <section v-if="step === 'photos'" class="stack">
    <div class="page-title">
      <div class="icon-circle"><MdiIcon :path="mdiCamera" :size="40" /></div>
      <h2>Photographier une recette</h2>
      <p>Prenez la page du livre bien à plat, avec un bon éclairage. Jusqu'à {{ MAX_PHOTOS }} photos si la recette tient sur plusieurs pages.</p>
      <hr class="divider" />
    </div>

    <div v-if="photos.length" class="thumbs">
      <figure v-for="(photo, i) in photos" :key="photo.url">
        <img :src="photo.url" :alt="`Page ${i + 1}`" />
        <button class="btn icon remove" title="Retirer" :disabled="extracting" @click="removePhoto(i)">
          <MdiIcon :path="mdiClose" :size="18" />
        </button>
        <figcaption>Page {{ i + 1 }}</figcaption>
      </figure>
    </div>

    <div v-if="photos.length < MAX_PHOTOS && !extracting" class="row">
      <label class="btn elevated primary large grow">
        <MdiIcon :path="mdiCamera" :size="20" /> {{ photos.length ? 'Autre page' : 'Photo' }}
        <input type="file" accept="image/*" capture="environment" hidden @change="addPhotos" />
      </label>
      <label class="btn outlined primary-text large grow">
        <MdiIcon :path="mdiImageMultiple" :size="20" /> Galerie
        <input type="file" accept="image/*" multiple hidden @change="addPhotos" />
      </label>
    </div>

    <p v-if="error" class="error">{{ error }}</p>

    <button v-if="photos.length" class="btn elevated success large block" :disabled="extracting" @click="extract">
      <span v-if="extracting" class="spinner" />
      <MdiIcon v-else :path="mdiTextRecognition" :size="20" />
      {{ extracting ? 'Lecture de la recette…' : 'Analyser la recette' }}
    </button>
  </section>

  <!-- Étape 2 : relecture -->
  <section v-else-if="step === 'review'" class="stack" style="padding-top: 16px">
    <article class="card">
      <div class="recipe-image">
        <img v-if="imageSrc" :src="imageSrc" alt="Image générée du plat" :class="{ dim: image.loading }" />
        <div v-if="image.loading || !imageSrc" class="placeholder">
          <template v-if="image.loading"><span class="spinner large" /> Gemini prépare une photo du plat…</template>
          <template v-else-if="image.error"><MdiIcon :path="mdiChefHat" :size="48" /> {{ image.error }}</template>
        </div>
        <button v-if="!image.disabled" class="btn elevated primary regen" :disabled="image.loading" @click="generateImage">
          <MdiIcon :path="mdiRefresh" :size="18" /> {{ imageSrc ? 'Autre image' : 'Réessayer' }}
        </button>
      </div>
      <div class="card-title">{{ recipe.name || 'Sans titre' }}</div>
      <div class="card-text">
        <div class="meta">
          <span v-if="recipe.recipeYield"><MdiIcon :path="mdiAccountGroup" :size="18" /> {{ recipe.recipeYield }}</span>
          <span v-for="[label, value] in times" :key="label"><MdiIcon :path="mdiClockOutline" :size="18" /> {{ label }} : {{ value }}</span>
        </div>
        <div v-if="recipe.tags.length" class="chips">
          <span v-for="tag in recipe.tags" :key="tag" class="chip">{{ tag }}</span>
        </div>
      </div>
    </article>

    <article class="card">
      <div class="card-title">Informations</div>
      <div class="card-text">
        <label class="field"><span>Nom de la recette</span><input v-model="recipe.name" required /></label>
        <label class="field"><span>Description</span><textarea v-model="recipe.description" rows="3" /></label>
        <div class="grid">
          <label class="field"><span>Portions</span><input v-model="recipe.recipeYield" placeholder="4 personnes" /></label>
          <label class="field"><span>Préparation</span><input v-model="recipe.prepTime" placeholder="20 min" /></label>
          <label class="field"><span>Cuisson</span><input v-model="recipe.cookTime" placeholder="45 min" /></label>
          <label class="field"><span>Temps total</span><input v-model="recipe.totalTime" placeholder="1 h 05" /></label>
        </div>
      </div>
    </article>

    <h3 class="section-title"><MdiIcon :path="mdiFormatListChecks" /> Ingrédients</h3>
    <ListEditor v-model="recipe.ingredients" add-label="Ingrédient" />

    <h3 class="section-title"><MdiIcon :path="mdiChefHat" /> Instructions</h3>
    <ListEditor v-model="recipe.instructions" steps add-label="Étape" />

    <article class="card">
      <div class="card-title"><MdiIcon :path="mdiTag" :size="20" /> Tags et notes</div>
      <div class="card-text">
        <TagsInput v-model="recipe.tags" />
        <label class="field"><span>Conseils / notes</span><textarea v-model="recipe.notes" rows="2" /></label>
        <label class="field"><span>Source</span><input v-model="recipe.source" placeholder="Livre, auteur, page" /></label>
      </div>
    </article>

    <p v-if="error" class="error">{{ error }}</p>

    <div class="sticky-actions row">
      <button class="btn text" @click="restart">Annuler</button>
      <button class="btn elevated success large grow" :disabled="sending || image.loading || !recipe.name?.trim()" @click="send">
        <span v-if="sending" class="spinner" />
        <MdiIcon v-else :path="mdiSend" :size="20" />
        {{ sending ? 'Envoi…' : image.loading ? 'Image en cours…' : imageSrc ? 'Envoyer dans Mealie' : 'Envoyer sans image' }}
      </button>
    </div>
  </section>

  <!-- Étape 3 : terminé -->
  <section v-else class="stack">
    <div class="page-title">
      <div class="success-circle"><MdiIcon :path="mdiCheck" :size="44" /></div>
      <h2>Recette ajoutée à Mealie</h2>
      <hr class="divider" />
    </div>
    <article class="card">
      <div v-if="imageSrc" class="recipe-image"><img :src="imageSrc" alt="" /></div>
      <div class="card-title">{{ recipe.name }}</div>
      <div v-if="recipe.tags.length" class="card-text">
        <div class="chips"><span v-for="tag in recipe.tags" :key="tag" class="chip">{{ tag }}</span></div>
      </div>
      <div class="card-actions">
        <a class="btn text accent-text" :href="result.url" target="_blank" rel="noopener">
          <MdiIcon :path="mdiOpenInNew" :size="18" /> Ouvrir dans Mealie
        </a>
      </div>
    </article>
    <button class="btn elevated primary large block" @click="restart">
      <MdiIcon :path="mdiCamera" :size="20" /> Nouvelle recette
    </button>
  </section>
</template>
