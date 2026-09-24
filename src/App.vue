<script setup>
import { ref } from 'vue'
import { mdiAccount, mdiLogout, mdiRefresh, mdiSilverwareVariant } from '@mdi/js'
import { registerSW } from 'virtual:pwa-register'
import { session, setSession } from './api.js'
import MdiIcon from './components/MdiIcon.vue'
import LoginView from './views/LoginView.vue'
import CaptureView from './views/CaptureView.vue'
import AccountView from './views/AccountView.vue'

const page = ref('capture')

// Nouvelle version déployée : l'appli installée garde l'ancienne en cache tant qu'on ne recharge pas
const needRefresh = ref(false)
const updateSW = registerSW({
  onNeedRefresh() { needRefresh.value = true },
  onRegisteredSW(url, registration) {
    if (!registration) return
    const check = () => registration.update().catch(() => {})
    setInterval(check, 60 * 60 * 1000)
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check() })
  }
})

function logout() {
  setSession(null, null)
  page.value = 'capture'
}
</script>

<template>
  <div v-if="needRefresh" class="update-banner">
    <span>Nouvelle version disponible</span>
    <button class="btn text" @click="updateSW(true)"><MdiIcon :path="mdiRefresh" :size="18" /> Mettre à jour</button>
  </div>
  <LoginView v-if="!session.token" />
  <template v-else>
    <header class="app-bar">
      <button class="title" @click="page = 'capture'">
        <MdiIcon :path="mdiSilverwareVariant" :size="32" />
        <span>Photo Recette</span>
      </button>
      <span class="spacer" />
      <button class="btn text" :title="session.user?.username" @click="page = page === 'account' ? 'capture' : 'account'">
        <MdiIcon :path="mdiAccount" :size="20" /> {{ session.user?.username }}
      </button>
      <button class="btn icon" title="Se déconnecter" @click="logout">
        <MdiIcon :path="mdiLogout" :size="20" />
      </button>
    </header>
    <main class="container">
      <KeepAlive>
        <CaptureView v-if="page === 'capture'" />
      </KeepAlive>
      <AccountView v-if="page === 'account'" @back="page = 'capture'" />
    </main>
  </template>
</template>
