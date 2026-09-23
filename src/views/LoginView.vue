<script setup>
import { ref } from 'vue'
import { api, setSession } from '../api.js'

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
      <img src="/icon.svg" alt="" width="64" height="64" />
      <h1>Photo Recette</h1>
      <p class="muted">Photographiez une recette, elle arrive dans Mealie.</p>
      <label>Identifiant
        <input v-model="username" autocomplete="username" autocapitalize="none" required />
      </label>
      <label>Mot de passe
        <input v-model="password" type="password" autocomplete="current-password" required />
      </label>
      <p v-if="error" class="error">{{ error }}</p>
      <button class="primary" :disabled="loading">{{ loading ? 'Connexion…' : 'Se connecter' }}</button>
    </form>
  </main>
</template>
