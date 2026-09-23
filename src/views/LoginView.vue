<script setup>
import { ref } from 'vue'
import { mdiSilverwareVariant } from '@mdi/js'
import { api, setSession } from '../api.js'
import MdiIcon from '../components/MdiIcon.vue'

const username = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)

async function submit() {
  error.value = ''
  loading.value = true
  try {
    const { token, user } = await api('/auth/login', { method: 'POST', body: { username: username.value, password: password.value } })
    setSession(token, user)
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <main class="login">
    <form class="card" @submit.prevent="submit">
      <div class="login-header">
        <MdiIcon :path="mdiSilverwareVariant" :size="56" />
        <h1>Photo Recette</h1>
        <p>Photographiez une recette, elle arrive dans Mealie</p>
      </div>
      <div class="card-text" style="padding-top: 24px">
        <label class="field"><span>Identifiant</span>
          <input v-model="username" autocomplete="username" autocapitalize="none" required />
        </label>
        <label class="field"><span>Mot de passe</span>
          <input v-model="password" type="password" autocomplete="current-password" required />
        </label>
        <p v-if="error" class="error">{{ error }}</p>
        <button class="btn elevated primary large block" :disabled="loading">
          <span v-if="loading" class="spinner" /> Se connecter
        </button>
      </div>
    </form>
  </main>
</template>
