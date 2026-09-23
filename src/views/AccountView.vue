<script setup>
import { onMounted, reactive, ref } from 'vue'
import { api, session } from '../api.js'

const emit = defineEmits(['logout'])

const pwd = reactive({ currentPassword: '', newPassword: '', message: '', error: '' })

async function changePassword() {
  Object.assign(pwd, { message: '', error: '' })
  try {
    await api('/auth/password', { method: 'POST', body: { currentPassword: pwd.currentPassword, newPassword: pwd.newPassword } })
    Object.assign(pwd, { currentPassword: '', newPassword: '', message: 'Mot de passe modifié' })
  } catch (err) {
    pwd.error = err.message
  }
}

// --- Administration ---
const users = ref([])
const newUser = reactive({ username: '', password: '', isAdmin: false })
const adminError = ref('')
const mealieStatus = ref('')

async function loadUsers() {
  users.value = (await api('/users')).users
}

async function addUser() {
  adminError.value = ''
  try {
    await api('/users', { method: 'POST', body: { ...newUser } })
    Object.assign(newUser, { username: '', password: '', isAdmin: false })
    await loadUsers()
  } catch (err) {
    adminError.value = err.message
  }
}

async function resetPassword(username) {
  const password = prompt(`Nouveau mot de passe pour « ${username} » (8 caractères minimum)`)
  if (!password) return
  adminError.value = ''
  try {
    await api(`/users/${encodeURIComponent(username)}/password`, { method: 'PUT', body: { password } })
    alert('Mot de passe réinitialisé')
  } catch (err) {
    adminError.value = err.message
  }
}

async function removeUser(username) {
  if (!confirm(`Supprimer le compte « ${username} » ?`)) return
  adminError.value = ''
  try {
    await api(`/users/${encodeURIComponent(username)}`, { method: 'DELETE' })
    await loadUsers()
  } catch (err) {
    adminError.value = err.message
  }
}

async function checkMealie() {
  mealieStatus.value = 'Test en cours…'
  try {
    const { user } = await api('/mealie/check')
    mealieStatus.value = `✓ Connecté à Mealie${user ? ` (compte ${user})` : ''}`
  } catch (err) {
    mealieStatus.value = `✕ ${err.message}`
  }
}

onMounted(() => {
  if (session.user?.isAdmin) loadUsers().catch(err => { adminError.value = err.message })
})
</script>

<template>
  <section class="stack">
    <div class="row between">
      <h2>Mon compte</h2>
      <button class="ghost small" @click="emit('logout')">Se déconnecter</button>
    </div>

    <form class="card stack" @submit.prevent="changePassword">
      <h3>Changer de mot de passe</h3>
      <label>Mot de passe actuel<input v-model="pwd.currentPassword" type="password" autocomplete="current-password" required /></label>
      <label>Nouveau mot de passe<input v-model="pwd.newPassword" type="password" autocomplete="new-password" minlength="8" required /></label>
      <p v-if="pwd.error" class="error">{{ pwd.error }}</p>
      <p v-if="pwd.message" class="ok">{{ pwd.message }}</p>
      <button class="primary">Enregistrer</button>
    </form>

    <template v-if="session.user?.isAdmin">
      <div class="card stack">
        <h3>Utilisateurs</h3>
        <ul class="users">
          <li v-for="u in users" :key="u.username">
            <span>{{ u.username }} <small v-if="u.isAdmin" class="badge">admin</small></span>
            <span class="row">
              <button class="ghost small" @click="resetPassword(u.username)">Mot de passe</button>
              <button v-if="u.username !== session.user.username" class="ghost small danger" @click="removeUser(u.username)">Supprimer</button>
            </span>
          </li>
        </ul>
        <form class="stack" @submit.prevent="addUser">
          <div class="grid">
            <label>Identifiant<input v-model="newUser.username" autocapitalize="none" required /></label>
            <label>Mot de passe<input v-model="newUser.password" type="password" autocomplete="new-password" minlength="8" required /></label>
          </div>
          <label class="check"><input v-model="newUser.isAdmin" type="checkbox" /> Administrateur</label>
          <p v-if="adminError" class="error">{{ adminError }}</p>
          <button class="primary">Ajouter l'utilisateur</button>
        </form>
      </div>

      <div class="card stack">
        <h3>Connexion à Mealie</h3>
        <button @click="checkMealie">Tester la connexion</button>
        <p v-if="mealieStatus">{{ mealieStatus }}</p>
      </div>
    </template>
  </section>
</template>
