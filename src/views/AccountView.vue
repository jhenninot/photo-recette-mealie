<script setup>
import { onMounted, reactive, ref } from 'vue'
import { mdiAccount, mdiAccountGroup, mdiAccountPlus, mdiArrowLeft, mdiDelete, mdiKeyVariant, mdiLan, mdiLockReset } from '@mdi/js'
import { api, session } from '../api.js'
import MdiIcon from '../components/MdiIcon.vue'

const emit = defineEmits(['back'])

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
    <div class="page-title">
      <div class="icon-circle"><MdiIcon :path="mdiAccount" :size="40" /></div>
      <h2>{{ session.user?.username }}</h2>
      <p>{{ session.user?.isAdmin ? 'Administrateur' : 'Utilisateur' }}</p>
      <hr class="divider" />
    </div>

    <form class="card left-border" @submit.prevent="changePassword">
      <div class="card-title"><MdiIcon :path="mdiKeyVariant" :size="22" /> Changer de mot de passe</div>
      <div class="card-text">
        <label class="field"><span>Mot de passe actuel</span><input v-model="pwd.currentPassword" type="password" autocomplete="current-password" required /></label>
        <label class="field"><span>Nouveau mot de passe</span><input v-model="pwd.newPassword" type="password" autocomplete="new-password" minlength="8" required /></label>
        <p v-if="pwd.error" class="error">{{ pwd.error }}</p>
        <p v-if="pwd.message" class="ok">{{ pwd.message }}</p>
      </div>
      <div class="card-actions"><button class="btn elevated success">Enregistrer</button></div>
    </form>

    <template v-if="session.user?.isAdmin">
      <div class="card left-border">
        <div class="card-title"><MdiIcon :path="mdiAccountGroup" :size="22" /> Utilisateurs</div>
        <div class="card-text">
          <ul class="users">
            <li v-for="u in users" :key="u.username">
              <span class="name">{{ u.username }} <span v-if="u.isAdmin" class="badge">admin</span></span>
              <span class="row">
                <button class="btn icon" title="Réinitialiser le mot de passe" @click="resetPassword(u.username)">
                  <MdiIcon :path="mdiLockReset" :size="20" />
                </button>
                <button v-if="u.username !== session.user.username" class="btn icon error-text" title="Supprimer" @click="removeUser(u.username)">
                  <MdiIcon :path="mdiDelete" :size="20" />
                </button>
              </span>
            </li>
          </ul>
        </div>
        <form @submit.prevent="addUser">
          <div class="card-text">
            <div class="grid">
              <label class="field"><span>Identifiant</span><input v-model="newUser.username" autocapitalize="none" required /></label>
              <label class="field"><span>Mot de passe</span><input v-model="newUser.password" type="password" autocomplete="new-password" minlength="8" required /></label>
            </div>
            <label class="checkbox"><input v-model="newUser.isAdmin" type="checkbox" /> Administrateur</label>
            <p v-if="adminError" class="error">{{ adminError }}</p>
          </div>
          <div class="card-actions">
            <button class="btn elevated success"><MdiIcon :path="mdiAccountPlus" :size="18" /> Créer</button>
          </div>
        </form>
      </div>

      <div class="card left-border">
        <div class="card-title"><MdiIcon :path="mdiLan" :size="22" /> Connexion à Mealie</div>
        <div v-if="mealieStatus" class="card-text"><p>{{ mealieStatus }}</p></div>
        <div class="card-actions"><button class="btn elevated info" @click="checkMealie">Tester la connexion</button></div>
      </div>
    </template>

    <button class="btn text" @click="emit('back')"><MdiIcon :path="mdiArrowLeft" :size="18" /> Retour</button>
  </section>
</template>
